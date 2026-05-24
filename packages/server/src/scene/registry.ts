import type { SceneId } from "@dndmate/shared";
import type { Framebuffer } from "../render";
import { blankScene } from "./blank-scene";
import { hourglassScene } from "./hourglass-scene";
import { enemyHpScene, partyHpScene } from "./hp-scene";
import type { Scene, SceneContext } from "./scene";

/** Every scene, keyed by id. */
const SCENES: Record<SceneId, Scene> = {
  "party-hp": partyHpScene,
  "enemy-hp": enemyHpScene,
  hourglass: hourglassScene,
  blank: blankScene,
};

/** Look up a scene by its id. */
export function getScene(id: SceneId): Scene {
  return SCENES[id];
}

/** Render whichever scene is named by `ctx.state.activeScene`. */
export function renderScene(ctx: SceneContext): Framebuffer {
  return getScene(ctx.state.activeScene).render(ctx);
}
