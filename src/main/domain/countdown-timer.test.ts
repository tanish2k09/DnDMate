import { describe, expect, test } from "vitest";
import { CountdownTimer } from "./countdown-timer";

describe("CountdownTimer", () => {
  test("starts with the full duration remaining", () => {
    const timer = new CountdownTimer();
    timer.start(120, 1000);
    const snapshot = timer.snapshot(1000);
    expect(snapshot.durationSeconds).toBe(120);
    expect(snapshot.remainingSeconds).toBe(120);
    expect(snapshot.running).toBe(true);
  });

  test("counts down as time passes", () => {
    const timer = new CountdownTimer();
    timer.start(60, 0);
    expect(timer.snapshot(10_000).remainingSeconds).toBeCloseTo(50, 5);
  });

  test("never goes below zero and stops running at zero", () => {
    const timer = new CountdownTimer();
    timer.start(5, 0);
    const snapshot = timer.snapshot(60_000);
    expect(snapshot.remainingSeconds).toBe(0);
    expect(snapshot.running).toBe(false);
  });

  test("pause banks the remaining time", () => {
    const timer = new CountdownTimer();
    timer.start(60, 0);
    timer.pause(20_000);
    const snapshot = timer.snapshot(50_000);
    expect(snapshot.remainingSeconds).toBeCloseTo(40, 5);
    expect(snapshot.running).toBe(false);
  });

  test("resume continues from the banked time", () => {
    const timer = new CountdownTimer();
    timer.start(60, 0);
    timer.pause(20_000);
    timer.resume(100_000);
    expect(timer.snapshot(110_000).remainingSeconds).toBeCloseTo(30, 5);
  });

  test("reset restores the full duration and stops", () => {
    const timer = new CountdownTimer();
    timer.start(60, 0);
    timer.reset();
    const snapshot = timer.snapshot(99_999);
    expect(snapshot.remainingSeconds).toBe(60);
    expect(snapshot.running).toBe(false);
  });

  test("addSeconds adjusts the remaining time", () => {
    const timer = new CountdownTimer();
    timer.start(60, 0);
    timer.addSeconds(30, 10_000);
    expect(timer.snapshot(10_000).remainingSeconds).toBeCloseTo(80, 5);
  });
});
