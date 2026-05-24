import { describe, expect, test } from "vitest";
import { GameStore } from "../domain/game-store";
import { defaultState, type StatePersister } from "../domain/state-repository";
import { LiveController } from "../orchestration/live-controller";
import { Framebuffer } from "../render/framebuffer";
import { MockBluetoothTransport } from "./mock-transport";
import { PixooBtClient } from "./pixoo-bt-client";
import { COMMAND } from "./protocol/commands";
import { decodeFrame } from "./protocol/framing";

function frameOf(width: number, height: number, fill: number[]): Framebuffer {
  const fb = new Framebuffer(width, height);
  for (let i = 0; i < fb.data.length; i++) fb.data[i] = fill[i % fill.length];
  return fb;
}

const noopPersister: StatePersister = { save: async () => {} };
const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function commandsOf(transport: MockBluetoothTransport): number[] {
  return transport.sent
    .map((bytes) => decodeFrame(bytes))
    .map((decoded) => (decoded.ok ? decoded.payload[0] : -1));
}

describe("PixooBtClient", () => {
  test("connects, switches to the custom channel, and pushes brightness on first settings update", async () => {
    const transport = new MockBluetoothTransport();
    const client = new PixooBtClient(transport);

    client.update({ host: "AA:BB:CC:DD:EE:FF", brightness: 75, model: "pixoo-max" });
    await tick();
    await tick();

    expect(transport.address).toBe("AA:BB:CC:DD:EE:FF");
    expect(transport.state).toBe("connected");
    expect(commandsOf(transport)).toEqual([COMMAND.SET_CHANNEL, COMMAND.SET_BRIGHTNESS]);
  });

  test("disconnects and reconnects when the address changes", async () => {
    const transport = new MockBluetoothTransport();
    const client = new PixooBtClient(transport);

    client.update({ host: "AA:BB:CC:DD:EE:FF", brightness: 50, model: "pixoo-max" });
    await tick();
    await tick();
    transport.clear();

    client.update({ host: "11:22:33:44:55:66", brightness: 50, model: "pixoo-max" });
    await tick();
    await tick();

    expect(transport.address).toBe("11:22:33:44:55:66");
    expect(transport.state).toBe("connected");
    expect(commandsOf(transport)).toEqual([COMMAND.SET_CHANNEL, COMMAND.SET_BRIGHTNESS]);
  });

  test("disconnects when the address is cleared", async () => {
    const transport = new MockBluetoothTransport();
    const client = new PixooBtClient(transport);

    client.update({ host: "AA:BB:CC:DD:EE:FF", brightness: 50, model: "pixoo-max" });
    await tick();
    await tick();

    client.update({ host: null, brightness: 50, model: "pixoo-max" });
    await tick();
    await tick();

    expect(transport.state).toBe("disconnected");
  });

  test("pushes a static-image frame every time push() is called", async () => {
    const transport = new MockBluetoothTransport();
    const client = new PixooBtClient(transport);
    client.update({ host: "AA:BB:CC:DD:EE:FF", brightness: 50, model: "pixoo-max" });
    await tick();
    await tick();
    transport.clear();

    client.push(frameOf(32, 32, [0x77]));
    await tick();
    await tick();

    const decoded = decodeFrame(transport.sent[0]);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.payload[0]).toBe(COMMAND.SET_STATIC_IMAGE);
    // Palette mode header: cmd(1) + prefix(4) + 0xAA(1) + frameSize(2) +
    // frameTime(2) + paletteType(1) + paletteCount(2) = 13 bytes.
    // Solid-color frame → 1 palette entry [0x77, 0x77, 0x77] at offset 13.
    expect(decoded.payload[10]).toBe(0x03); // paletteType
    expect(decoded.payload[11]).toBe(1); // paletteCount = 1
    expect(Array.from(decoded.payload.slice(13, 16))).toEqual([0x77, 0x77, 0x77]);
  });

  test("coalesces frames that arrive while a send is in flight", async () => {
    const transport = new MockBluetoothTransport();
    const client = new PixooBtClient(transport);
    client.update({ host: "AA:BB:CC:DD:EE:FF", brightness: 50, model: "pixoo-max" });
    await tick();
    await tick();
    transport.clear();

    // Three rapid pushes; the latest pixels should win.
    client.push(frameOf(1, 1, [0x11]));
    client.push(frameOf(1, 1, [0x22]));
    client.push(frameOf(1, 1, [0x33]));
    await tick();
    await tick();
    await tick();

    expect(transport.sent.length).toBeGreaterThanOrEqual(1);
    expect(transport.sent.length).toBeLessThanOrEqual(3);
    const last = decodeFrame(transport.sent[transport.sent.length - 1]);
    if (!last.ok) throw new Error("decode failed");
    // 1x1 solid 0x33 frame → palette = [0x33, 0x33, 0x33] at offset 13.
    expect(Array.from(last.payload.slice(13, 16))).toEqual([0x33, 0x33, 0x33]);
  });

  test("only re-sends brightness when the value moves", async () => {
    const transport = new MockBluetoothTransport();
    const client = new PixooBtClient(transport);
    client.update({ host: "AA:BB:CC:DD:EE:FF", brightness: 50, model: "pixoo-max" });
    await tick();
    await tick();
    transport.clear();

    client.update({ host: "AA:BB:CC:DD:EE:FF", brightness: 50, model: "pixoo-max" });
    await tick();
    await tick();
    expect(transport.sent).toHaveLength(0);

    client.update({ host: "AA:BB:CC:DD:EE:FF", brightness: 80, model: "pixoo-max" });
    await tick();
    await tick();
    expect(commandsOf(transport)).toEqual([COMMAND.SET_BRIGHTNESS]);
  });

  test("end-to-end: LiveController + GameStore drive the mock transport", async () => {
    const transport = new MockBluetoothTransport();
    const client = new PixooBtClient(transport);
    const store = new GameStore(
      {
        ...defaultState(),
        device: { host: "AA:BB:CC:DD:EE:FF", brightness: 50, model: "pixoo-max" },
      },
      noopPersister,
    );
    const controller = new LiveController({
      store,
      device: client,
      onDraftFrame: () => {},
      onLiveFrame: () => {},
      onPendingChange: () => {},
      onDraftState: () => {},
    });
    controller.start();
    await tick();
    await tick();
    await tick();

    // We expect: SET_CHANNEL (after connect) + SET_BRIGHTNESS + at least one
    // SET_STATIC_IMAGE for the initial render (LiveController auto-commits).
    const commands = commandsOf(transport);
    expect(commands).toContain(COMMAND.SET_CHANNEL);
    expect(commands).toContain(COMMAND.SET_BRIGHTNESS);
    expect(commands).toContain(COMMAND.SET_STATIC_IMAGE);

    controller.stop();
    await client.dispose();
  });
});
