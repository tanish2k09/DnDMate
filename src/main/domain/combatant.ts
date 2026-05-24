import type { Combatant } from "../../shared";
import { generateId } from "./ids";

/** Create a new combatant at full health. `maxHp` is forced to at least 1. */
export function createCombatant(name: string, maxHp: number): Combatant {
  const hp = Math.max(1, Math.round(maxHp) || 1);
  return {
    id: generateId(),
    name: name.trim() || "Unnamed",
    currentHp: hp,
    maxHp: hp,
  };
}

/** Return a copy of the combatant with `currentHp`/`maxHp` clamped to sane values. */
export function clampHp(combatant: Combatant): Combatant {
  const maxHp = Math.max(1, Math.round(combatant.maxHp) || 1);
  const currentHp = Math.min(maxHp, Math.max(0, Math.round(combatant.currentHp) || 0));
  return { ...combatant, currentHp, maxHp };
}
