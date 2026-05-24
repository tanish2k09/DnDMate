import type { PreviewMessage } from "@dndmate/shared";
import { encodeFrame, type Framebuffer } from "../render";

/** Convert a framebuffer into a `PreviewMessage` for the browser live preview. */
export function framebufferToPreview(fb: Framebuffer): PreviewMessage {
  return {
    type: "preview",
    width: fb.width,
    height: fb.height,
    data: encodeFrame(fb),
  };
}
