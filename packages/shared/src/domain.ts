/** Core domain types shared by the server and the web UI. */

/** Supported Divoom display models. */
export type DeviceModel = "pixoo-max" | "pixoo-64";

/** A creature with hit points — a party member or an enemy. */
export interface Combatant {
  readonly id: string;
  name: string;
  currentHp: number;
  maxHp: number;
}

/** Which roster a combatant belongs to. */
export type CombatantGroup = "party" | "enemy";

/** Connection and display settings for the Pixoo device. */
export interface DeviceSettings {
  /** Device host/IP, or null when running without hardware. */
  host: string | null;
  /** Display brightness, 0-100. */
  brightness: number;
  model: DeviceModel;
}

/** The scenes that can drive the display. */
export const SCENE_IDS = ["party-hp", "enemy-hp", "hourglass", "blank"] as const;

/** Identifier of the scene currently shown on the device. */
export type SceneId = (typeof SCENE_IDS)[number];

/** Whether a value is a valid {@link SceneId}. */
export function isSceneId(value: unknown): value is SceneId {
  return typeof value === "string" && (SCENE_IDS as readonly string[]).includes(value);
}

/** A serialisable snapshot of the countdown timer. */
export interface TimerSnapshot {
  /** Total configured duration, in seconds. */
  durationSeconds: number;
  /** Seconds left, computed live. */
  remainingSeconds: number;
  /** Whether the timer is currently counting down. */
  running: boolean;
}

/** The complete game state broadcast to every connected client. */
export interface GameState {
  party: Combatant[];
  enemies: Combatant[];
  device: DeviceSettings;
  activeScene: SceneId;
  timer: TimerSnapshot;
}
