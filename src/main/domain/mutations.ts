import type { Combatant, CombatantClass, CombatantGroup, SceneId } from "../../shared";
import { clampHp } from "./combatant";
import type { PersistedState } from "./state-repository";

/**
 * Semantic, dedup'able actions that can be queued for commit.
 *
 * Frames are not stored in the queue — only intents. At render and commit
 * time the cumulative effect is recomputed from the committed state, so
 * multiple HP edits to the same combatant collapse to one final value (only
 * the last one in the queue takes effect).
 *
 * Each variant carries an `id` field where needed so {@link mutationKey}
 * can produce a stable dedup key (e.g. all "adjust-hp" for the same
 * combatant share a key).
 */
export type Mutation =
  | { kind: "adjust-hp"; combatantId: string; currentHp: number }
  | {
      kind: "update-combatant";
      combatantId: string;
      name?: string;
      maxHp?: number;
      currentHp?: number;
      charClass?: CombatantClass;
    }
  | {
      kind: "add-combatant";
      combatantId: string;
      group: CombatantGroup;
      name: string;
      maxHp: number;
      charClass: CombatantClass;
    }
  | { kind: "remove-combatant"; combatantId: string }
  | { kind: "set-scene"; scene: SceneId };

/**
 * Identifier used for queue dedup. Two queued mutations with the same key
 * collapse: the later one replaces the earlier one. Keys must be stable for
 * mutations that target the same entity (so re-editing Grog's HP overwrites
 * his previous queued HP change) and unique for those that don't
 * (`add-combatant` carries a fresh id so each add is a distinct queue entry).
 */
export function mutationKey(mutation: Mutation): string {
  switch (mutation.kind) {
    case "adjust-hp":
      return `hp:${mutation.combatantId}`;
    case "update-combatant":
      return `update:${mutation.combatantId}`;
    case "add-combatant":
      return `add:${mutation.combatantId}`;
    case "remove-combatant":
      return `remove:${mutation.combatantId}`;
    case "set-scene":
      return "scene";
  }
}

/** Apply a single mutation to a state snapshot — pure function. */
export function applyMutation(state: PersistedState, mutation: Mutation): PersistedState {
  switch (mutation.kind) {
    case "adjust-hp":
      return mapCombatant(state, mutation.combatantId, (c) => clampHp({ ...c, currentHp: mutation.currentHp }));
    case "update-combatant":
      return mapCombatant(state, mutation.combatantId, (c) => {
        const next: Combatant = { ...c };
        if (mutation.name !== undefined) next.name = mutation.name.trim() || c.name;
        if (mutation.maxHp !== undefined) next.maxHp = mutation.maxHp;
        if (mutation.currentHp !== undefined) next.currentHp = mutation.currentHp;
        if (mutation.charClass !== undefined) next.charClass = mutation.charClass;
        return clampHp(next);
      });
    case "add-combatant": {
      const fresh: Combatant = {
        id: mutation.combatantId,
        name: mutation.name,
        maxHp: mutation.maxHp,
        currentHp: mutation.maxHp,
        charClass: mutation.charClass,
      };
      if (mutation.group === "party") return { ...state, party: [...state.party, fresh] };
      return { ...state, enemies: [...state.enemies, fresh] };
    }
    case "remove-combatant":
      return {
        ...state,
        party: state.party.filter((c) => c.id !== mutation.combatantId),
        enemies: state.enemies.filter((c) => c.id !== mutation.combatantId),
      };
    case "set-scene":
      return { ...state, activeScene: mutation.scene };
  }
}

/** Apply mutations in order, folding into a fresh state. */
export function applyMutations(state: PersistedState, mutations: readonly Mutation[]): PersistedState {
  let result = state;
  for (const mutation of mutations) result = applyMutation(result, mutation);
  return result;
}

function mapCombatant(
  state: PersistedState,
  id: string,
  fn: (c: Combatant) => Combatant,
): PersistedState {
  return {
    ...state,
    party: state.party.map((c) => (c.id === id ? fn(c) : c)),
    enemies: state.enemies.map((c) => (c.id === id ? fn(c) : c)),
  };
}
