import type { DeviceModel } from "../../shared";

/**
 * Geometric profile of a Divoom device — width and height only. This is what
 * the renderer and the scene layer need to stay resolution-agnostic. Transport
 * concerns (BT framing, throughput, ack handling) belong in `src/main/bluetooth/`
 * when M3 lands.
 */
export interface DeviceProfile {
  readonly width: number;
  readonly height: number;
}

/** Divoom Pixoo Max — 32x32. The default target for DnDMate. */
export const PIXOO_MAX: DeviceProfile = { width: 32, height: 32 };

/** Divoom Pixoo 64 — 64x64. Supported because the renderer is resolution-agnostic. */
export const PIXOO_64: DeviceProfile = { width: 64, height: 64 };

export function profileForModel(model: DeviceModel): DeviceProfile {
  return model === "pixoo-64" ? PIXOO_64 : PIXOO_MAX;
}
