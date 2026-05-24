/** Core domain types shared by the server and the web UI. */

/** Supported Divoom display models. */
export type DeviceModel = "pixoo-max" | "pixoo-64";

/** Character class — drives the icon shown on the Pixoo render. */
export const COMBATANT_CLASSES = [
  "barbarian",
  "wizard",
  "paladin",
  "bard",
  "ranger",
  "druid",
  "other",
] as const;
export type CombatantClass = (typeof COMBATANT_CLASSES)[number];

export function isCombatantClass(value: unknown): value is CombatantClass {
  return typeof value === "string" && (COMBATANT_CLASSES as readonly string[]).includes(value);
}

/** A creature with hit points — a party member or an enemy. */
export interface Combatant {
  readonly id: string;
  name: string;
  currentHp: number;
  maxHp: number;
  charClass: CombatantClass;
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

/**
 * Versioning for {@link SavedSnapshot}. Bump when an existing field changes
 * shape in a way the normalize() fallback can't recover; older files are
 * always loadable as long as the loader fills missing fields with defaults.
 */
export const SNAPSHOT_SCHEMA_VERSION = 1;

/** Metadata returned when listing saved snapshots; no game state included. */
export interface SavedSnapshotMetadata {
  /** Stable id (UUID), used as the file name. */
  readonly id: string;
  /** User-given display name (may contain any unicode, may collide). */
  readonly name: string;
  /** ISO 8601 timestamp of the save. */
  readonly savedAt: string;
  /** Schema version of the on-disk file. */
  readonly schemaVersion: number;
  /** App version that produced the file (informational). */
  readonly appVersion: string;
}

/**
 * A save file as it lives on disk. The `payload` is intentionally untyped at
 * the wire level (`Record<string, unknown>`) so future fields don't break the
 * envelope parser; the main process re-normalizes it back into a real
 * {@link GameState}-shaped object on load.
 */
export interface SavedSnapshot extends SavedSnapshotMetadata {
  readonly payload: Record<string, unknown>;
}
