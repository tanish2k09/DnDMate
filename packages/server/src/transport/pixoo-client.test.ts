import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { MockDevice } from "../mock/mock-device";
import { Framebuffer } from "../render";
import type { DeviceProfile } from "./device-profile";
import { PixooClient } from "./pixoo-client";

/** A profile with a tiny push interval so tests do not wait on real timers. */
const FAST_PROFILE: DeviceProfile = {
  width: 32,
  height: 32,
  pushIntervalMs: 5,
  frameCap: 60,
  resetEveryFrames: 32,
};

describe("PixooClient + MockDevice", () => {
  let device: MockDevice;

  beforeEach(() => {
    device = new MockDevice({ width: 32, height: 32 });
    device.start();
  });

  afterEach(() => {
    device.stop();
  });

  function newClient(): PixooClient {
    return new PixooClient({ baseUrl: device.url, profile: FAST_PROFILE });
  }

  test("showFrame sends one frame to the device", async () => {
    const client = newClient();
    client.showFrame(new Framebuffer(32, 32));
    await client.whenIdle();

    expect(device.state.frameCount).toBe(1);
    expect(device.lastFrame?.length).toBe(32 * 32 * 3);
    expect(client.health).toBe("healthy");
  });

  test("showAnimation uploads every frame with no PicID violation", async () => {
    const client = newClient();
    client.showAnimation(
      [new Framebuffer(32, 32), new Framebuffer(32, 32), new Framebuffer(32, 32)],
      120,
    );
    await client.whenIdle();

    expect(device.state.frameCount).toBe(3);
    expect(device.state.picIdViolations).toBe(0);
  });

  test("rapid frames are coalesced", async () => {
    const client = newClient();
    client.showFrame(new Framebuffer(32, 32));
    client.showFrame(new Framebuffer(32, 32));
    client.showFrame(new Framebuffer(32, 32));
    await client.whenIdle();

    expect(device.state.frameCount).toBeGreaterThanOrEqual(1);
    expect(device.state.frameCount).toBeLessThan(3);
  });

  test("connect resets the device GIF id", async () => {
    const client = newClient();
    await client.connect();
    expect(device.state.resetCount).toBe(1);
  });

  test("setBrightness reaches the device", async () => {
    const client = newClient();
    await client.setBrightness(55);
    expect(device.state.brightness).toBe(55);
  });

  test("getGifId reads a numeric id from the device", async () => {
    const client = newClient();
    client.showFrame(new Framebuffer(32, 32));
    await client.whenIdle();
    expect(typeof (await client.getGifId())).toBe("number");
  });

  test("health degrades to unresponsive when the device is unreachable", async () => {
    const client = new PixooClient({
      baseUrl: "http://127.0.0.1:9",
      profile: FAST_PROFILE,
      timeoutMs: 250,
    });
    for (let i = 0; i < 3; i++) {
      client.showFrame(new Framebuffer(32, 32));
      await client.whenIdle();
    }
    expect(client.health).toBe("unresponsive");
  });
});
