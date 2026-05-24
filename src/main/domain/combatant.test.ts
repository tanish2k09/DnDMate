import { describe, expect, test } from "vitest";
import { clampHp, createCombatant } from "./combatant";

describe("createCombatant", () => {
  test("starts at full health with a unique id", () => {
    const combatant = createCombatant("Grog", 45);
    expect(combatant.currentHp).toBe(45);
    expect(combatant.maxHp).toBe(45);
    expect(combatant.id).toBeTruthy();
  });

  test("forces maxHp to at least 1 and names the unnamed", () => {
    const combatant = createCombatant("   ", 0);
    expect(combatant.maxHp).toBe(1);
    expect(combatant.name).toBe("Unnamed");
  });
});

describe("clampHp", () => {
  test("clamps currentHp into [0, maxHp]", () => {
    expect(clampHp({ id: "x", name: "n", currentHp: 99, maxHp: 30 }).currentHp).toBe(30);
    expect(clampHp({ id: "x", name: "n", currentHp: -5, maxHp: 30 }).currentHp).toBe(0);
  });
});
