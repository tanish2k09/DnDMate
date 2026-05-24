import { describe, expect, test } from "vitest";
import { PushScheduler } from "./push-scheduler";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("PushScheduler", () => {
  test("ticks repeatedly while running", async () => {
    let ticks = 0;
    const scheduler = new PushScheduler(20, () => {
      ticks += 1;
    });
    scheduler.start();
    expect(scheduler.running).toBe(true);
    await delay(90);
    scheduler.stop();
    expect(ticks).toBeGreaterThanOrEqual(2);
  });

  test("stops ticking after stop()", async () => {
    let ticks = 0;
    const scheduler = new PushScheduler(20, () => {
      ticks += 1;
    });
    scheduler.start();
    await delay(50);
    scheduler.stop();
    const afterStop = ticks;
    await delay(50);
    expect(ticks).toBe(afterStop);
    expect(scheduler.running).toBe(false);
  });

  test("start is idempotent", () => {
    const scheduler = new PushScheduler(20, () => {});
    scheduler.start();
    scheduler.start();
    expect(scheduler.running).toBe(true);
    scheduler.stop();
  });
});
