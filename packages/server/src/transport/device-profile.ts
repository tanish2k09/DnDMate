import type { DeviceModel } from "@dndmate/shared";

/**
 * A device profile captures everything the transport layer needs to know about
 * a particular Divoom model. Keeping it in one object is what makes the rest of
 * the renderer and transport resolution-agnostic.
 */
export interface DeviceProfile {
  /** Display width in pixels. */
  readonly width: number;
  /** Display height in pixels. */
  readonly height: number;
  /** Minimum milliseconds between device requests (Divoom devices want ~1/sec). */
  readonly pushIntervalMs: number;
  /** Maximum frames the device accepts in a single animation. */
  readonly frameCap: number;
  /** Reset the GIF id after this many frame pushes, to avoid the PicID overflow. */
  readonly resetEveryFrames: number;
}

/** Divoom Pixoo Max — 32x32. The default target for DnDMate. */
export const PIXOO_MAX: DeviceProfile = {
  width: 32,
  height: 32,
  pushIntervalMs: 1100,
  frameCap: 60,
  resetEveryFrames: 32,
};

/** Divoom Pixoo 64 — 64x64. Supported because the renderer is resolution-agnostic. */
export const PIXOO_64: DeviceProfile = {
  width: 64,
  height: 64,
  pushIntervalMs: 1100,
  frameCap: 90,
  resetEveryFrames: 32,
};

/** Pick the device profile for a model. */
export function profileForModel(model: DeviceModel): DeviceProfile {
  return model === "pixoo-64" ? PIXOO_64 : PIXOO_MAX;
}
