import type { DeviceModel, DeviceSettings } from "@dndmate/shared";
import type { Framebuffer } from "../render";
import type { ConnectionHealth } from "../transport/connection-monitor";
import { profileForModel } from "../transport/device-profile";
import { PixooClient } from "../transport/pixoo-client";
import type { DeviceSink } from "./live-controller";

/**
 * Owns the live {@link PixooClient}, recreating it when the configured host or
 * model changes and disposing it when no device is configured. When there is no
 * device, frame pushes are simply dropped — the browser preview still works.
 */
export class DeviceConnection implements DeviceSink {
  private client: PixooClient | null = null;
  private currentHost: string | null = null;
  private currentModel: DeviceModel | null = null;
  private appliedBrightness: number | null = null;

  /** Reconcile the connection with the latest device settings. */
  update(settings: DeviceSettings): void {
    if (settings.host !== this.currentHost || settings.model !== this.currentModel) {
      this.client?.dispose();
      this.currentHost = settings.host;
      this.currentModel = settings.model;
      this.appliedBrightness = null;
      this.client = settings.host ? this.createClient(settings.host, settings.model) : null;
    }
    if (this.client && settings.brightness !== this.appliedBrightness) {
      this.appliedBrightness = settings.brightness;
      this.client.setBrightness(settings.brightness).catch(() => {
        // Brightness is best-effort; failures surface via connection health.
      });
    }
  }

  /** Display a frame, or drop it silently if no device is configured. */
  push(frame: Framebuffer): void {
    this.client?.showFrame(frame);
  }

  /** Current device health, or `"offline"` when no device is configured. */
  get health(): ConnectionHealth | "offline" {
    return this.client ? this.client.health : "offline";
  }

  /** Dispose the underlying client. */
  dispose(): void {
    this.client?.dispose();
    this.client = null;
  }

  private createClient(host: string, model: DeviceModel): PixooClient {
    const client = new PixooClient({
      baseUrl: `http://${host}`,
      profile: profileForModel(model),
    });
    client.connect().catch(() => {
      // The initial reset is best-effort; failures surface via connection health.
    });
    return client;
  }
}
