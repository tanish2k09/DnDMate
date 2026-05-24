import { describe, expect, test } from "bun:test";
import type { Combatant, GameState } from "@dndmate/shared";
import type { Framebuffer } from "../render";
import { partyHpScene } from "./hp-scene";
import type { SceneContext } from "./scene";

function combatant(name: string, currentHp: number, maxHp: number): Combatant {
  return { id: name, name, currentHp, maxHp };
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

/** Count visually-bright pixels (HP fill, text) — a proxy for "how much is lit". */
function brightCount(fb: Framebuffer): number {
  let count = 0;
  for (let i = 0; i < fb.data.length; i += 3) {
    if (fb.data[i] + fb.data[i + 1] + fb.data[i + 2] > 220) count += 1;
  }
  return count;
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
    const healthy = [combatant("Grog", 30, 30), combatant("Vex", 24, 24)];
    const wounded = [combatant("Grog", 1, 30), combatant("Vex", 1, 24)];
    expect(brightCount(partyHpScene.render(context(32, 32, healthy)))).toBeGreaterThan(
      brightCount(partyHpScene.render(context(32, 32, wounded))),
    );
  });

  test("an empty roster still renders a label", () => {
    expect(brightCount(partyHpScene.render(context(32, 32, [])))).toBeGreaterThan(0);
  });
});
