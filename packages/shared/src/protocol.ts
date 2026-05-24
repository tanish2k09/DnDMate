/**
 * Wire protocol shared by the server and the web UI.
 *
 * The browser only ever talks to the local server, so all live updates travel
 * over a single same-origin WebSocket at `/ws`.
 */

import type { GameState } from "./domain";

/** A framebuffer snapshot for the live preview. */
export interface PreviewMessage {
  readonly type: "preview";
  /** Display width in pixels. */
  readonly width: number;
  /** Display height in pixels. */
  readonly height: number;
  /** Base64-encoded RGB bytes, row-major — identical to the device `PicData`. */
  readonly data: string;
}

/** The full game state, broadcast whenever it changes. */
export interface StateMessage {
  readonly type: "state";
  readonly state: GameState;
}

/** Messages the server pushes to connected browsers. */
export type ServerMessage = PreviewMessage | StateMessage;
