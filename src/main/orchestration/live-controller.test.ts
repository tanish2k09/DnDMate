import { describe, expect, test } from "vitest";
import type { DeviceSettings } from "../../shared";
import { GameStore } from "../domain/game-store";
import { defaultState, type StatePersister } from "../domain/state-repository";
import type { Framebuffer } from "../render";
import { type DeviceSink, LiveController } from "./live-controller";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const noopPersister: StatePersister = { save: async () => {} };

class FakeSink implements DeviceSink {
  readonly pushed: Framebuffer[] = [];
  update(_settings: DeviceSettings): void {}
  push(frame: Framebuffer): void {
    this.pushed.push(frame);
  }
}

function setup(tickIntervalMs?: number) {
  const store = new GameStore(defaultState(), noopPersister);
  const sink = new FakeSink();
  const frames: Framebuffer[] = [];
  const controller = new LiveController({
    store,
    device: sink,
    onFrame: (frame) => frames.push(frame),
    tickIntervalMs,
  });
  return { store, sink, frames, controller };
}

describe("LiveController", () => {
  test("renders an initial frame on start", () => {
    const { controller, frames } = setup();
    controller.start();
    expect(frames).toHaveLength(1);
    controller.stop();
  });

  test("re-renders when the store changes", () => {
    const { controller, frames, store } = setup();
    controller.start();
    store.addCombatant("party", "Grog", 30);
    expect(frames).toHaveLength(2);
    controller.stop();
  });

  test("pushes rendered frames to the device sink", () => {
    const { controller, sink, store } = setup();
    controller.start();
    store.setActiveScene("blank");
    expect(sink.pushed.length).toBeGreaterThanOrEqual(2);
    controller.stop();
  });

  test("ticks while a countdown is running", async () => {
    const { controller, frames, store } = setup(20);
    store.setActiveScene("hourglass");
    store.startTimer(60);
    controller.start();
    const before = frames.length;
    await delay(80);
    controller.stop();
    expect(frames.length).toBeGreaterThan(before);
  });

  test("does not tick for a static scene", async () => {
    const { controller, frames, store } = setup(20);
    store.setActiveScene("party-hp");
    controller.start();
    const before = frames.length;
    await delay(80);
    controller.stop();
    expect(frames).toHaveLength(before);
  });
});
