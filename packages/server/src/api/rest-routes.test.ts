import { describe, expect, test } from "bun:test";
import { GameStore } from "../domain/game-store";
import { defaultState, type StatePersister } from "../domain/state-repository";
import { createRestRouter } from "./rest-routes";

const noopPersister: StatePersister = { save: async () => {} };

function setup() {
  const store = new GameStore(defaultState(), noopPersister);
  const router = createRestRouter(store);
  const call = (method: string, path: string, body?: unknown) =>
    router(
      new Request(`http://localhost${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      new URL(`http://localhost${path}`),
    );
  return { store, call };
}

describe("REST router", () => {
  test("ignores non-API paths", async () => {
    const { call } = setup();
    expect(await call("GET", "/index.html")).toBeNull();
  });

  test("GET /api/state returns the game state", async () => {
    const { call } = setup();
    const res = await call("GET", "/api/state");
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body).toHaveProperty("party");
    expect(body).toHaveProperty("timer");
  });

  test("POST /api/combatants adds a combatant", async () => {
    const { store, call } = setup();
    const res = await call("POST", "/api/combatants", {
      group: "party",
      name: "Grog",
      maxHp: 40,
    });
    expect(res?.status).toBe(201);
    expect(store.toState().party).toHaveLength(1);
  });

  test("POST /api/combatants rejects an invalid body", async () => {
    const { call } = setup();
    expect((await call("POST", "/api/combatants", { name: "x" }))?.status).toBe(400);
  });

  test("PATCH /api/combatants/:id updates HP", async () => {
    const { store, call } = setup();
    const combatant = store.addCombatant("party", "Grog", 40);
    const res = await call("PATCH", `/api/combatants/${combatant.id}`, { currentHp: 12 });
    expect(res?.status).toBe(200);
    expect(store.toState().party[0].currentHp).toBe(12);
  });

  test("DELETE /api/combatants/:id removes a combatant", async () => {
    const { store, call } = setup();
    const combatant = store.addCombatant("enemy", "Goblin", 7);
    expect((await call("DELETE", `/api/combatants/${combatant.id}`))?.status).toBe(200);
    expect(store.toState().enemies).toHaveLength(0);
  });

  test("an unknown combatant id returns 404", async () => {
    const { call } = setup();
    expect((await call("DELETE", "/api/combatants/nope"))?.status).toBe(404);
  });

  test("POST /api/scene sets the active scene", async () => {
    const { store, call } = setup();
    expect((await call("POST", "/api/scene", { scene: "hourglass" }))?.status).toBe(200);
    expect(store.toState().activeScene).toBe("hourglass");
  });

  test("POST /api/timer starts the timer", async () => {
    const { store, call } = setup();
    expect((await call("POST", "/api/timer", { action: "start", seconds: 120 }))?.status).toBe(200);
    expect(store.toState().timer.durationSeconds).toBe(120);
  });

  test("PATCH /api/settings updates the device host", async () => {
    const { store, call } = setup();
    expect((await call("PATCH", "/api/settings", { host: "10.0.0.5" }))?.status).toBe(200);
    expect(store.toState().device.host).toBe("10.0.0.5");
  });
});
