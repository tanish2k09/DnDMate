/**
 * Typed payloads exchanged between the Electron main process and the renderer
 * over IPC. Same shapes that previously travelled over WebSocket in v1, plus
 * the action surface that replaces the old REST API.
 */

import type { CombatantGroup, DeviceModel, GameState, SceneId } from "./domain";

/** A framebuffer snapshot for the live preview. */
export interface PreviewMessage {
  readonly type: "preview";
  /** Display width in pixels. */
  readonly width: number;
  /** Display height in pixels. */
  readonly height: number;
  /** Base64-encoded RGB bytes, row-major. */
  readonly data: string;
}

/** The full game state, pushed whenever it changes. */
export interface StateMessage {
  readonly type: "state";
  readonly state: GameState;
}

/** Messages the main process pushes to the renderer. */
export type MainPushMessage = PreviewMessage | StateMessage;

/** Settings the renderer can patch on the device. */
export interface DeviceSettingsPatch {
  host?: string | null;
  brightness?: number;
  model?: DeviceModel;
}

/** All timer commands collapse to a single discriminated union. */
export type TimerCommand =
  | { action: "start"; seconds: number }
  | { action: "pause" }
  | { action: "resume" }
  | { action: "reset" }
  | { action: "add"; delta: number };

/** Combatant create payload. */
export interface AddCombatantInput {
  group: CombatantGroup;
  name: string;
  maxHp: number;
}

/** Bluetooth connection lifecycle, surfaced to the renderer status badge. */
export type BtConnectionStatus = "disconnected" | "connecting" | "connected" | "unavailable";

export interface BtStatusMessage {
  readonly type: "bt-status";
  readonly status: BtConnectionStatus;
  /** Address currently bound (or last attempted), if any. */
  readonly address: string | null;
  /** Human-readable failure detail when status is "disconnected" after an error. */
  readonly error: string | null;
}

/** One paired Bluetooth device returned by the scanner. */
export interface ScannedDevice {
  readonly address: string;
  readonly name: string;
  /** Heuristic: true when the name pattern-matches a known Divoom product. */
  readonly isPixooLike: boolean;
}

/**
 * The initial snapshot returned to the renderer on connect — saves a round-trip
 * waiting for the first state/preview push.
 */
export interface Snapshot {
  state: GameState;
  preview: PreviewMessage | null;
  bt: BtStatusMessage;
}

/** IPC channel names, namespaced by direction + intent. */
export const IpcChannel = {
  // Main → renderer events.
  PushState: "dndmate:push:state",
  PushPreview: "dndmate:push:preview",
  PushBtStatus: "dndmate:push:bt-status",
  // Renderer → main invocations.
  Snapshot: "dndmate:get:snapshot",
  ScanDevices: "dndmate:get:scan-devices",
  AddCombatant: "dndmate:act:add-combatant",
  AdjustHp: "dndmate:act:adjust-hp",
  RemoveCombatant: "dndmate:act:remove-combatant",
  SetScene: "dndmate:act:set-scene",
  UpdateSettings: "dndmate:act:update-settings",
  Timer: "dndmate:act:timer",
} as const;

/**
 * The shape preload exposes to the renderer on `window.dndmate`. Renderers
 * call these instead of the old REST/WebSocket clients.
 */
export interface DndmateApi {
  readonly version: string;
  /** One-shot snapshot used for first render. */
  snapshot(): Promise<Snapshot>;
  /** Subscribe to state pushes; returns an unsubscribe fn. */
  onState(listener: (state: GameState) => void): () => void;
  /** Subscribe to preview frames; returns an unsubscribe fn. */
  onPreview(listener: (preview: PreviewMessage) => void): () => void;
  /** Subscribe to BT connection status changes; returns an unsubscribe fn. */
  onBtStatus(listener: (status: BtStatusMessage) => void): () => void;
  /** List devices the OS has already paired with this host. */
  scanDevices(): Promise<ScannedDevice[]>;
  /** Action surface — the v1 REST API, transported over IPC. */
  readonly actions: {
    addCombatant(input: AddCombatantInput): Promise<void>;
    adjustHp(id: string, currentHp: number): Promise<void>;
    removeCombatant(id: string): Promise<void>;
    setScene(scene: SceneId): Promise<void>;
    updateSettings(patch: DeviceSettingsPatch): Promise<void>;
    timer(command: TimerCommand): Promise<void>;
  };
}
