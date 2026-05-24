import { join } from "node:path";
import { type Combatant, type DeviceSettings, isSceneId, type SceneId } from "../../shared";
import { readJson, writeJson } from "./json-store";

/** The portion of game state that survives a server restart. */
export interface PersistedState {
  party: Combatant[];
  enemies: Combatant[];
  device: DeviceSettings;
  activeScene: SceneId;
}

/** Anything the {@link GameStore} can persist its state to. */
export interface StatePersister {
  save(state: PersistedState): Promise<void>;
}

/**
 * Project-root `data/` directory (stable regardless of the process cwd).
 * Used as a development fallback; Electron's main entry overrides this with
 * `app.getPath('userData')` once packaged.
 */
const DATA_DIR = join(import.meta.dirname, "../../../../data");
const STATE_FILE = join(DATA_DIR, "dndmate.json");

/** A fresh default state for first run. */
export function defaultState(): PersistedState {
  return {
    party: [],
    enemies: [],
    device: { host: null, brightness: 75, model: "pixoo-max" },
    activeScene: "party-hp",
  };
}

/** Loads and saves the persisted game state as a JSON file on disk. */
export class StateRepository implements StatePersister {
  constructor(private readonly file: string = STATE_FILE) {}

  async load(): Promise<PersistedState> {
    return normalize(await readJson<unknown>(this.file, null));
  }

  async save(state: PersistedState): Promise<void> {
    await writeJson(this.file, state);
  }
}

/** Coerce arbitrary parsed JSON into a valid {@link PersistedState}. */
function normalize(raw: unknown): PersistedState {
  const fallback = defaultState();
  if (typeof raw !== "object" || raw === null) {
    return fallback;
  }
  const state = raw as Partial<PersistedState>;
  const device =
    typeof state.device === "object" && state.device !== null
      ? (state.device as Partial<DeviceSettings>)
      : {};

  return {
    party: Array.isArray(state.party) ? state.party : [],
    enemies: Array.isArray(state.enemies) ? state.enemies : [],
    device: {
      host: typeof device.host === "string" ? device.host : null,
      brightness:
        typeof device.brightness === "number"
          ? Math.min(100, Math.max(0, Math.round(device.brightness)))
          : fallback.device.brightness,
      model: device.model === "pixoo-64" ? "pixoo-64" : "pixoo-max",
    },
    activeScene: isSceneId(state.activeScene) ? state.activeScene : fallback.activeScene,
  };
}
