import type { Framebuffer } from "./framebuffer";

/**
 * Encode framebuffers into the base64 `PicData` payload the Divoom
 * `Draw/SendHttpGif` command expects: raw RGB bytes, row-major, with multi-frame
 * animations being the frames concatenated in order.
 */

/** Encode a single framebuffer as base64 RGB bytes. */
export function encodeFrame(fb: Framebuffer): string {
  return Buffer.from(fb.data).toString("base64");
}

/** Encode several equally-sized framebuffers as one base64 multi-frame payload. */
export function encodeFrames(frames: readonly Framebuffer[]): string {
  if (frames.length === 0) {
    throw new Error("encodeFrames: at least one frame is required");
  }
  const first = frames[0];
  const frameBytes = first.data.length;
  const combined = new Uint8Array(frameBytes * frames.length);
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (frame.width !== first.width || frame.height !== first.height) {
      throw new Error("encodeFrames: all frames must share the same dimensions");
    }
    combined.set(frame.data, i * frameBytes);
  }
  return Buffer.from(combined).toString("base64");
}

/** Decode a base64 `PicData` string back into raw RGB bytes. */
export function decodePicData(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}
