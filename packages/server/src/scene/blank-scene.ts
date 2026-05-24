import { Framebuffer } from "../render";
import type { Scene } from "./scene";

/** A scene that shows nothing — used to clear the display. */
export const blankScene: Scene = {
  id: "blank",
  render: (ctx) => new Framebuffer(ctx.width, ctx.height),
};
