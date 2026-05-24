/**
 * Typed payloads exchanged between the Electron main process and the renderer
 * over IPC. Same shapes that previously travelled over WebSocket in v1, plus
 * the action surface that replaces the old REST API.
 */

import type {
  CombatantClass,
  CombatantGroup,
  DeviceModel,
  GameState,
  SavedSnapshotMetadata,
  SceneId,
} from "./domain";

/** A framebuffer snapshot for a preview canvas. */
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

/** Queue-depth update broadcast whenever the draft queue grows or drains. */
export interface PendingMessage {
  readonly type: "pending";
  readonly count: number;
}

/** Messages the main process pushes to the renderer. */
export type MainPushMessage = PreviewMessage | StateMessage | PendingMessage;

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
  charClass: CombatantClass;
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
  /** Latest draft preview (what the user is composing). */
  draftPreview: PreviewMessage | null;
  /** Latest live preview (what's actually on the device). */
  livePreview: PreviewMessage | null;
  /** Number of draft frames waiting for commit. */
  pendingCount: number;
  bt: BtStatusMessage;
}

/** IPC channel names, namespaced by direction + intent. */
export const IpcChannel = {
  // Main → renderer events.
  PushState: "dndmate:push:state",
  PushDraftPreview: "dndmate:push:draft-preview",
  PushLivePreview: "dndmate:push:live-preview",
  PushPending: "dndmate:push:pending",
  PushBtStatus: "dndmate:push:bt-status",
  // Renderer → main invocations.
  Snapshot: "dndmate:get:snapshot",
  ScanDevices: "dndmate:get:scan-devices",
  AddCombatant: "dndmate:act:add-combatant",
  AdjustHp: "dndmate:act:adjust-hp",
  SetCombatantClass: "dndmate:act:set-combatant-class",
  RemoveCombatant: "dndmate:act:remove-combatant",
  SetScene: "dndmate:act:set-scene",
  UpdateSettings: "dndmate:act:update-settings",
  Timer: "dndmate:act:timer",
  ListSnapshots: "dndmate:get:list-snapshots",
  SaveSnapshot: "dndmate:act:save-snapshot",
  LoadSnapshot: "dndmate:act:load-snapshot",
  DeleteSnapshot: "dndmate:act:delete-snapshot",
  ExportSnapshot: "dndmate:act:export-snapshot",
  ImportSnapshot: "dndmate:act:import-snapshot",
  Commit: "dndmate:act:commit",
  Discard: "dndmate:act:discard",
  RunFrameBenchmark: "dndmate:act:run-frame-benchmark",
  ReconnectDevice: "dndmate:act:reconnect-device",
} as const;

/** Result of the export/import file-picker flows. */
export interface SnapshotFileResult {
  /** True if the user completed the operation; false if they cancelled. */
  readonly ok: boolean;
  /** Slot metadata after the operation (importing adds a new slot). */
  readonly snapshot: SavedSnapshotMetadata | null;
  /** Path of the file written / read (null if cancelled). */
  readonly path: string | null;
  /** Error message, if any. */
  readonly error: string | null;
}

/** A single sample collected during the frame-rate benchmark. */
export interface BenchmarkSample {
  readonly paletteCount: number;
  readonly payloadBytes: number;
  readonly ms: number;
}

/** Outcome of {@link DndmateApi.actions.runFrameBenchmark}. */
export interface BenchmarkResult {
  readonly ok: boolean;
  readonly error: string | null;
  readonly samples: BenchmarkSample[];
  /** Total wall time across all samples. */
  readonly totalMs: number;
  /** Average ms per frame. */
  readonly avgMs: number;
  /** Equivalent frames per second from the average. */
  readonly fps: number;
}

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
  /** Subscribe to draft-preview frames (composing); returns an unsubscribe fn. */
  onDraftPreview(listener: (preview: PreviewMessage) => void): () => void;
  /** Subscribe to live-preview frames (on-device); returns an unsubscribe fn. */
  onLivePreview(listener: (preview: PreviewMessage) => void): () => void;
  /** Subscribe to queue-depth changes; returns an unsubscribe fn. */
  onPending(listener: (count: number) => void): () => void;
  /** Subscribe to BT connection status changes; returns an unsubscribe fn. */
  onBtStatus(listener: (status: BtStatusMessage) => void): () => void;
  /** List devices the OS has already paired with this host. */
  scanDevices(): Promise<ScannedDevice[]>;
  /** Action surface — the v1 REST API, transported over IPC. */
  readonly actions: {
    addCombatant(input: AddCombatantInput): Promise<void>;
    adjustHp(id: string, currentHp: number): Promise<void>;
    setCombatantClass(id: string, charClass: CombatantClass): Promise<void>;
    removeCombatant(id: string): Promise<void>;
    setScene(scene: SceneId): Promise<void>;
    updateSettings(patch: DeviceSettingsPatch): Promise<void>;
    timer(command: TimerCommand): Promise<void>;
    listSnapshots(): Promise<SavedSnapshotMetadata[]>;
    saveSnapshot(name: string): Promise<SavedSnapshotMetadata>;
    loadSnapshot(id: string): Promise<boolean>;
    deleteSnapshot(id: string): Promise<void>;
    exportSnapshot(name: string): Promise<SnapshotFileResult>;
    importSnapshot(): Promise<SnapshotFileResult>;
    commit(): Promise<void>;
    discard(): Promise<void>;
    runFrameBenchmark(): Promise<BenchmarkResult>;
    reconnectDevice(): Promise<void>;
  };
}
