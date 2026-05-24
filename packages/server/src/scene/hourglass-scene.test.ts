import { describe, expect, test } from "bun:test";
import type { GameState } from "@dndmate/shared";
import { colorsEqual, type Framebuffer } from "../render";
import { hourglassScene } from "./hourglass-scene";
import { SAND, SAND_LOW } from "./palette";
import type { SceneContext } from "./scene";

function context(
  width: number,
  height: number,
  remaining: number,
  duration: number,
  running = true,
): SceneContext {
  const state: GameState = {
    party: [],
    enemies: [],
    device: { host: null, brightness: 75, model: "pixoo-max" },
    activeScene: "hourglass",
    timer: { durationSeconds: duration, remainingSeconds: remaining, running },
  };
  return { width, height, now: 0, state };
}

/** Count sand-colored pixels within a horizontal band. */
function sandCount(fb: Framebuffer, yStart: number, yEnd: number): number {
  let count = 0;
  for (let y = yStart; y < yEnd; y++) {
    for (let x = 0; x < fb.width; x++) {
      const pixel = fb.get(x, y);
      if (colorsEqual(pixel, SAND) || colorsEqual(pixel, SAND_LOW)) count += 1;
    }
  }
  return count;
}

describe("hourglassScene", () => {
  test("renders at 32x32 and 64x64", () => {
    for (const size of [32, 64]) {
      const fb = hourglassScene.render(context(size, size, 30, 60));
      expect(fb.width).toBe(size);
      expect(fb.height).toBe(size);
    }
  });

  test("sand sits in the top bulb when the timer is full", () => {
    const fb = hourglassScene.render(context(32, 32, 60, 60));
    expect(sandCount(fb, 0, 16)).toBeGreaterThan(sandCount(fb, 16, 32));
  });

  test("sand sits in the bottom bulb when time is up", () => {
    const fb = hourglassScene.render(context(32, 32, 0, 60, false));
    expect(sandCount(fb, 16, 32)).toBeGreaterThan(sandCount(fb, 0, 16));
  });
});
