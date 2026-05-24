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

function setup(opts?: { tickIntervalMs?: number; commitFrameMs?: number }) {
  const store = new GameStore(defaultState(), noopPersister);
  // Seed two combatants so we can test per-combatant action dedup without
  // tripping over the "default scene only renders party" gotcha.
  store.addCombatant("party", "Grog", 30);
  store.addCombatant("party", "Vex", 24);
  const grog = store.toState().party[0];
  const vex = store.toState().party[1];

  const sink = new FakeSink();
  const draftFrames: Framebuffer[] = [];
  const liveFrames: Framebuffer[] = [];
  const pendingCounts: number[] = [];
  const controller = new LiveController({
    store,
    device: sink,
    onDraftFrame: (frame) => draftFrames.push(frame),
    onLiveFrame: (frame) => liveFrames.push(frame),
    onPendingChange: (count) => pendingCounts.push(count),
    onDraftState: () => {},
    tickIntervalMs: opts?.tickIntervalMs,
    commitFrameMs: opts?.commitFrameMs ?? 5,
  });
  return { store, sink, draftFrames, liveFrames, pendingCounts, controller, grog, vex };
}

describe("LiveController", () => {
  test("auto-commits the initial frame on start", () => {
    const { controller, sink, draftFrames, liveFrames, pendingCounts } = setup();
    controller.start();
    expect(sink.pushed.length).toBeGreaterThanOrEqual(1);
    expect(liveFrames.length).toBeGreaterThanOrEqual(1);
    expect(draftFrames.length).toBeGreaterThanOrEqual(1);
    expect(pendingCounts[pendingCounts.length - 1]).toBe(0);
    controller.stop();
  });

  test("enqueueing a mutation does not push to the device", () => {
    const { controller, sink, pendingCounts, grog } = setup();
    controller.start();
    const pushedBefore = sink.pushed.length;
    controller.enqueue({ kind: "adjust-hp", combatantId: grog.id, currentHp: 10 });
    expect(sink.pushed.length).toBe(pushedBefore);
    expect(pendingCounts[pendingCounts.length - 1]).toBe(1);
    controller.stop();
  });

  test("repeated HP edits to the same combatant collapse to one queued action", () => {
    const { controller, pendingCounts, grog } = setup();
    controller.start();
    controller.enqueue({ kind: "adjust-hp", combatantId: grog.id, currentHp: 25 });
    controller.enqueue({ kind: "adjust-hp", combatantId: grog.id, currentHp: 20 });
    controller.enqueue({ kind: "adjust-hp", combatantId: grog.id, currentHp: 15 });
    expect(pendingCounts[pendingCounts.length - 1]).toBe(1);
    controller.stop();
  });

  test("HP edits for different combatants stay as distinct actions", () => {
    const { controller, pendingCounts, grog, vex } = setup();
    controller.start();
    controller.enqueue({ kind: "adjust-hp", combatantId: grog.id, currentHp: 25 });
    controller.enqueue({ kind: "adjust-hp", combatantId: vex.id, currentHp: 10 });
    expect(pendingCounts[pendingCounts.length - 1]).toBe(2);
    controller.stop();
  });

  test("commit applies queued mutations to the store and pushes a frame per action", async () => {
    const { controller, sink, store, pendingCounts, grog, vex } = setup();
    controller.start();
    const pushedBefore = sink.pushed.length;
    controller.enqueue({ kind: "adjust-hp", combatantId: grog.id, currentHp: 10 });
    controller.enqueue({ kind: "adjust-hp", combatantId: vex.id, currentHp: 5 });
    controller.commit();
    await delay(40);
    expect(sink.pushed.length).toBe(pushedBefore + 2);
    const after = store.toState().party;
    expect(after.find((c) => c.id === grog.id)?.currentHp).toBe(10);
    expect(after.find((c) => c.id === vex.id)?.currentHp).toBe(5);
    expect(pendingCounts[pendingCounts.length - 1]).toBe(0);
    controller.stop();
  });

  test("commit with empty queue re-pushes the current live frame", () => {
    const { controller, sink } = setup();
    controller.start();
    const pushedBefore = sink.pushed.length;
    controller.commit();
    expect(sink.pushed.length).toBe(pushedBefore + 1);
    controller.stop();
  });

  test("discard clears the queue without touching the device", () => {
    const { controller, sink, store, pendingCounts, grog } = setup();
    controller.start();
    const pushedBefore = sink.pushed.length;
    const grogHpBefore = store.toState().party.find((c) => c.id === grog.id)!.currentHp;
    controller.enqueue({ kind: "adjust-hp", combatantId: grog.id, currentHp: 1 });
    controller.discard();
    expect(sink.pushed.length).toBe(pushedBefore);
    expect(store.toState().party.find((c) => c.id === grog.id)!.currentHp).toBe(grogHpBefore);
    expect(pendingCounts[pendingCounts.length - 1]).toBe(0);
    controller.stop();
  });

  test("hourglass scheduler ticks bypass the queue and push to the device", async () => {
    const { controller, sink, store, liveFrames } = setup({ tickIntervalMs: 20 });
    store.setActiveScene("hourglass");
    store.startTimer(60);
    controller.start();
    const pushedBefore = sink.pushed.length;
    const liveBefore = liveFrames.length;
    await delay(80);
    controller.stop();
    expect(sink.pushed.length).toBeGreaterThan(pushedBefore);
    expect(liveFrames.length).toBeGreaterThan(liveBefore);
  });
});
