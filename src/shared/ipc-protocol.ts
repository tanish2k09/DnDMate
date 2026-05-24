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

/**
 * The initial snapshot returned to the renderer on connect — saves a round-trip
 * waiting for the first state/preview push.
 */
export interface Snapshot {
  state: GameState;
  preview: PreviewMessage | null;
}

/** IPC channel names, namespaced by direction + intent. */
export const IpcChannel = {
  // Main → renderer events.
  PushState: "dndmate:push:state",
  PushPreview: "dndmate:push:preview",
  // Renderer → main invocations.
  Snapshot: "dndmate:get:snapshot",
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
