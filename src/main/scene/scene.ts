import type { GameState, SceneId } from "@shared";
import type { Framebuffer } from "../render";

/** Everything a scene needs to render one frame. */
export interface SceneContext {
  /** Display width in pixels. */
  readonly width: number;
  /** Display height in pixels. */
  readonly height: number;
  /** The current game state. */
  readonly state: GameState;
  /** Wall-clock milliseconds, for animation effects (blinking, the sand stream). */
  readonly now: number;
}

/** A scene paints the game state onto a framebuffer at the device's resolution. */
export interface Scene {
  readonly id: SceneId;
  render(ctx: SceneContext): Framebuffer;
}
