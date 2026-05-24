import type { DeviceSettings } from "../../shared";
import type { Framebuffer } from "../render";
import type { DeviceSink } from "./live-controller";

/**
 * Placeholder {@link DeviceSink} that drops every frame. M3 replaces this with a
 * Bluetooth-backed implementation that pushes frames to a real Pixoo Max. Until
 * then, the renderer preview is the only output.
 */
export class NullDeviceConnection implements DeviceSink {
  update(_settings: DeviceSettings): void {
    // No hardware connected.
  }

  push(_frame: Framebuffer): void {
    // Frame is dropped; the renderer preview is the only output until M3.
  }
}
