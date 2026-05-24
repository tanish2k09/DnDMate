import type { CombatantGroup, DeviceModel, SceneId } from "@dndmate/shared";

/**
 * Send an intent to the server. Failures are logged rather than thrown — the UI
 * is server-authoritative, so it simply re-renders when the resulting state
 * broadcast arrives over the WebSocket.
 */
async function send(path: string, method: string, body?: unknown): Promise<void> {
  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      console.warn(`${method} ${path} -> HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn(`${method} ${path} failed`, error);
  }
}

export interface DeviceSettingsPatch {
  host?: string | null;
  brightness?: number;
  model?: DeviceModel;
}

/** Typed wrappers around the server's REST API. */
export const restClient = {
  addCombatant: (group: CombatantGroup, name: string, maxHp: number) =>
    send("/api/combatants", "POST", { group, name, maxHp }),
  adjustHp: (id: string, currentHp: number) =>
    send(`/api/combatants/${id}`, "PATCH", { currentHp }),
  removeCombatant: (id: string) => send(`/api/combatants/${id}`, "DELETE"),
  setScene: (scene: SceneId) => send("/api/scene", "POST", { scene }),
  updateSettings: (patch: DeviceSettingsPatch) => send("/api/settings", "PATCH", patch),
  startTimer: (seconds: number) => send("/api/timer", "POST", { action: "start", seconds }),
  pauseTimer: () => send("/api/timer", "POST", { action: "pause" }),
  resumeTimer: () => send("/api/timer", "POST", { action: "resume" }),
  resetTimer: () => send("/api/timer", "POST", { action: "reset" }),
  addTimerSeconds: (delta: number) => send("/api/timer", "POST", { action: "add", delta }),
};

export type RestClient = typeof restClient;
