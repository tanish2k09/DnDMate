import { describe, expect, test } from "vitest";
import type { Combatant, CombatantClass, GameState } from "../../shared";
import type { Framebuffer } from "../render";
import { partyHpScene } from "./hp-scene";
import type { SceneContext } from "./scene";

function combatant(
  name: string,
  currentHp: number,
  maxHp: number,
  charClass: CombatantClass = "barbarian",
): Combatant {
  return { id: name, name, currentHp, maxHp, charClass };
}

function context(width: number, height: number, party: Combatant[]): SceneContext {
  const state: GameState = {
    party,
    enemies: [],
    device: { host: null, brightness: 75, model: "pixoo-max" },
    activeScene: "party-hp",
    timer: { durationSeconds: 60, remainingSeconds: 60, running: false },
  };
  return { width, height, now: 0, state };
}

function brightCount(fb: Framebuffer): number {
  let count = 0;
  for (let i = 0; i < fb.data.length; i += 3) {
    if (fb.data[i] + fb.data[i + 1] + fb.data[i + 2] > 220) count += 1;
  }
  return count;
}

function sumAt(fb: Framebuffer, x: number, y: number): number {
  const o = (y * fb.width + x) * 3;
  return fb.data[o] + fb.data[o + 1] + fb.data[o + 2];
}

describe("partyHpScene", () => {
  test("renders at 32x32 and 64x64", () => {
    for (const size of [32, 64]) {
      const fb = partyHpScene.render(context(size, size, [combatant("Grog", 30, 30)]));
      expect(fb.width).toBe(size);
      expect(fb.height).toBe(size);
    }
  });

  test("a healthy roster lights more pixels than a wounded one", () => {
    const healthy = [combatant("Grog", 30, 30), combatant("Vex", 24, 24, "ranger")];
    const wounded = [combatant("Grog", 1, 30), combatant("Vex", 1, 24, "ranger")];
    expect(brightCount(partyHpScene.render(context(32, 32, healthy)))).toBeGreaterThan(
      brightCount(partyHpScene.render(context(32, 32, wounded))),
    );
  });

  test("an empty roster still renders something visible", () => {
    expect(brightCount(partyHpScene.render(context(32, 32, [])))).toBeGreaterThan(0);
  });

  test("fractional fill puts a dim tail pixel between full and empty", () => {
    // 30/100 HP → ~30% fill. Layout geometry is adaptive; instead of
    // hard-coding pixel coordinates we scan the bar row and verify the
    // expected three-zone structure: bright → dim transition → dark track.
    const fb = partyHpScene.render(context(32, 32, [combatant("Grog", 30, 100)]));
    // Find the brightest row in the panel — that's the middle of the HP bar.
    let bestY = 0;
    let bestRowSum = -1;
    for (let y = 0; y < fb.height; y++) {
      let row = 0;
      for (let x = 0; x < fb.width; x++) row += sumAt(fb, x, y);
      if (row > bestRowSum) {
        bestRowSum = row;
        bestY = y;
      }
    }
    // Walk the bar row left to right collecting per-pixel brightness past x=8
    // (skip the icon zone, which is constant white).
    const samples: number[] = [];
    for (let x = 8; x < fb.width; x++) samples.push(sumAt(fb, x, bestY));
    const brightest = Math.max(...samples);
    const dimmest = Math.min(...samples);
    // Some sample must be strictly between brightest and dimmest — the tail.
    const hasTail = samples.some((v) => v < brightest && v > dimmest);
    expect(hasTail).toBe(true);
  });
});
