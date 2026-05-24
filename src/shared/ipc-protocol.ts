/**
 * Typed payloads exchanged between the Electron main process and the renderer
 * over IPC. Same shapes that previously travelled over WebSocket in v1.
 */

import type { GameState } from "./domain";

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
