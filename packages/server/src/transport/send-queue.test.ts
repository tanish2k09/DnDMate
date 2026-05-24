import { describe, expect, test } from "bun:test";
import { SendQueue, type SendQueueClock } from "./send-queue";

/** A deterministic clock whose `sleep` instantly advances virtual time. */
function fakeClock(): SendQueueClock & { time: number } {
  const clock = {
    time: 0,
    now() {
      return clock.time;
    },
    async sleep(ms: number) {
      clock.time += ms;
    },
  };
  return clock;
}

describe("SendQueue", () => {
  test("enforces the minimum interval between tasks", async () => {
    const clock = fakeClock();
    const queue = new SendQueue(1000, clock);
    const starts: number[] = [];

    for (let i = 0; i < 3; i++) {
      void queue.pushCommand(async () => {
        starts.push(clock.time);
      });
    }
    await queue.whenIdle();

    expect(starts).toEqual([0, 1000, 2000]);
  });

  test("coalesces frames pushed while one is in flight", async () => {
    const queue = new SendQueue(0);
    const ran: string[] = [];

    queue.pushFrame(async () => {
      ran.push("a");
    });
    queue.pushFrame(async () => {
      ran.push("b");
    });
    queue.pushFrame(async () => {
      ran.push("c");
    });
    await queue.whenIdle();

    // "a" goes out immediately; "b" is superseded by "c".
    expect(ran).toEqual(["a", "c"]);
  });

  test("runs commands first-in first-out", async () => {
    const queue = new SendQueue(0);
    const order: number[] = [];

    for (const n of [1, 2, 3]) {
      void queue.pushCommand(async () => {
        order.push(n);
      });
    }
    await queue.whenIdle();

    expect(order).toEqual([1, 2, 3]);
  });

  test("pushCommand resolves with the task result", async () => {
    const queue = new SendQueue(0);
    expect(await queue.pushCommand(async () => 42)).toBe(42);
  });

  test("pushCommand rejects when the task throws", async () => {
    const queue = new SendQueue(0);
    await expect(
      queue.pushCommand(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  test("dispose clears the queue and rejects new commands", async () => {
    const queue = new SendQueue(0);
    queue.dispose();
    expect(queue.pendingCommands).toBe(0);
    await expect(queue.pushCommand(async () => 1)).rejects.toThrow();
  });
});
