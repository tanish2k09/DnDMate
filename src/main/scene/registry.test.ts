import { describe, expect, test } from "vitest";
import type { GameState, SceneId } from "../../shared";
import type { Framebuffer } from "../render";
import { getScene, renderScene } from "./registry";
import type { SceneContext } from "./scene";

function context(activeScene: SceneId): SceneContext {
  const state: GameState = {
    party: [],
    enemies: [],
    device: { host: null, brightness: 75, model: "pixoo-max" },
    activeScene,
    timer: { durationSeconds: 60, remainingSeconds: 60, running: false },
  };
  return { width: 32, height: 32, now: 0, state };
}

/** Count pixels with any non-zero channel. */
function litCount(fb: Framebuffer): number {
  let count = 0;
  for (let i = 0; i < fb.data.length; i++) {
    if (fb.data[i] !== 0) count += 1;
  }
  return count;
}

describe("scene registry", () => {
  test("getScene returns the scene with the matching id", () => {
    expect(getScene("hourglass").id).toBe("hourglass");
    expect(getScene("party-hp").id).toBe("party-hp");
    expect(getScene("enemy-hp").id).toBe("enemy-hp");
    expect(getScene("blank").id).toBe("blank");
  });

  test("renderScene dispatches on the active scene", () => {
    expect(litCount(renderScene(context("blank")))).toBe(0);
    expect(litCount(renderScene(context("hourglass")))).toBeGreaterThan(0);
  });
});
