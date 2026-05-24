import { describe, expect, test } from "vitest";
import { GameStore } from "./game-store";
import { defaultState, type StatePersister } from "./state-repository";

const noopPersister: StatePersister = { save: async () => {} };

function newStore(): GameStore {
  return new GameStore(defaultState(), noopPersister);
}

describe("GameStore", () => {
  test("adds combatants to the correct roster", () => {
    const store = newStore();
    store.addCombatant("party", "Grog", 50);
    store.addCombatant("enemy", "Goblin", 7);
    const state = store.toState();
    expect(state.party).toHaveLength(1);
    expect(state.enemies).toHaveLength(1);
    expect(state.party[0].name).toBe("Grog");
  });

  test("updates a combatant and clamps HP", () => {
    const store = newStore();
    const combatant = store.addCombatant("party", "Grog", 50);
    expect(store.updateCombatant(combatant.id, { currentHp: 999 })?.currentHp).toBe(50);
    expect(store.updateCombatant("missing", { currentHp: 1 })).toBeNull();
  });

  test("removes a combatant", () => {
    const store = newStore();
    const combatant = store.addCombatant("enemy", "Goblin", 7);
    expect(store.removeCombatant(combatant.id)).toBe(true);
    expect(store.removeCombatant(combatant.id)).toBe(false);
    expect(store.toState().enemies).toHaveLength(0);
  });

  test("notifies listeners until they unsubscribe", () => {
    const store = newStore();
    let calls = 0;
    const unsubscribe = store.onChange(() => {
      calls += 1;
    });
    store.addCombatant("party", "A", 10);
    store.setActiveScene("hourglass");
    unsubscribe();
    store.addCombatant("party", "B", 10);
    expect(calls).toBe(2);
  });

  test("updates device settings and clamps brightness", () => {
    const store = newStore();
    store.updateDeviceSettings({ host: "192.168.1.50", brightness: 250 });
    const device = store.toState().device;
    expect(device.host).toBe("192.168.1.50");
    expect(device.brightness).toBe(100);
  });

  test("drives the countdown timer", () => {
    const store = newStore();
    store.startTimer(90);
    const timer = store.toState().timer;
    expect(timer.durationSeconds).toBe(90);
    expect(timer.running).toBe(true);
  });
});
