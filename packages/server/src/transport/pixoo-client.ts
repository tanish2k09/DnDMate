import { encodeFrame, Framebuffer } from "../render";
import { type ConnectionHealth, ConnectionMonitor } from "./connection-monitor";
import type { DeviceProfile } from "./device-profile";
import { PicIdManager } from "./pic-id-manager";
import {
  playBuzzer as buildPlayBuzzer,
  setBrightness as buildSetBrightness,
  getHttpGifId,
  type PixooCommand,
  type PixooResponse,
  resetHttpGifId,
  sendHttpGif,
} from "./pixoo-commands";
import { SendQueue } from "./send-queue";
import { PixooDeviceError, PixooHttpError, PixooTimeoutError } from "./transport-errors";

const DEFAULT_TIMEOUT_MS = 8000;
const SINGLE_FRAME_SPEED_MS = 1000;

export interface PixooClientOptions {
  /** Device base URL, e.g. `http://192.168.1.50`. */
  readonly baseUrl: string;
  readonly profile: DeviceProfile;
  readonly timeoutMs?: number;
  /** Injectable fetch implementation (used by tests). */
  readonly fetchFn?: typeof fetch;
}

export interface PixooStats {
  readonly health: ConnectionHealth;
  readonly cumulativeUpdates: number;
  readonly picId: number;
}

/**
 * The single device-facing class. It owns the rate-limited send queue, the
 * PicID counter, and the connection-health monitor, so the rest of the app can
 * push frames without worrying about Divoom's timing quirks.
 */
export class PixooClient {
  private readonly baseUrl: string;
  private readonly profile: DeviceProfile;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly queue: SendQueue;
  private readonly picIds: PicIdManager;
  private readonly monitor = new ConnectionMonitor();

  constructor(options: PixooClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.profile = options.profile;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? fetch;
    this.queue = new SendQueue(this.profile.pushIntervalMs);
    this.picIds = new PicIdManager(this.profile.resetEveryFrames);
  }

  /** Reset the device's GIF id so a fresh session starts cleanly. */
  connect(): Promise<void> {
    return this.queue.pushCommand(async () => {
      await this.post(resetHttpGifId());
      this.picIds.markReset();
      this.monitor.markRefreshed();
    });
  }

  /** Display a single still frame. */
  showFrame(frame: Framebuffer): void {
    this.showAnimation([frame], SINGLE_FRAME_SPEED_MS);
  }

  /** Display a multi-frame animation, capped at the device's frame limit. */
  showAnimation(frames: readonly Framebuffer[], speedMs: number): void {
    if (frames.length === 0) return;
    const capped = frames.slice(0, this.profile.frameCap);
    this.queue.pushFrame(() => this.uploadAnimation(capped, speedMs));
  }

  /** Clear the display by showing an all-black frame. */
  clear(): void {
    this.showFrame(new Framebuffer(this.profile.width, this.profile.height));
  }

  /** Set the device brightness (0-100). */
  setBrightness(value: number): Promise<void> {
    return this.queue.pushCommand(async () => {
      await this.post(buildSetBrightness(value));
    });
  }

  /** Sound the device buzzer. */
  playBuzzer(): Promise<void> {
    return this.queue.pushCommand(async () => {
      await this.post(buildPlayBuzzer());
    });
  }

  /** Read the device's current GIF id. */
  getGifId(): Promise<number> {
    return this.queue.pushCommand(async () => {
      const response = await this.post(getHttpGifId());
      return typeof response.PicId === "number" ? response.PicId : 0;
    });
  }

  /** Resolves once every queued request has been sent. */
  whenIdle(): Promise<void> {
    return this.queue.whenIdle();
  }

  get health(): ConnectionHealth {
    return this.monitor.state;
  }

  get stats(): PixooStats {
    return {
      health: this.monitor.state,
      cumulativeUpdates: this.monitor.updateCount,
      picId: this.picIds.value,
    };
  }

  /** Stop the send queue and discard pending work. */
  dispose(): void {
    this.queue.dispose();
  }

  private async uploadAnimation(frames: readonly Framebuffer[], speedMs: number): Promise<void> {
    try {
      await this.maybeRefresh();
      const picId = this.picIds.next();
      for (let i = 0; i < frames.length; i++) {
        await this.post(
          sendHttpGif({
            picNum: frames.length,
            picWidth: this.profile.width,
            picOffset: i,
            picId,
            picSpeed: speedMs,
            picData: encodeFrame(frames[i]),
          }),
        );
      }
      this.monitor.recordSuccess();
    } catch {
      this.monitor.recordFailure();
    }
  }

  /** Reset the GIF id when the PicID cadence or the cumulative-update backstop is due. */
  private async maybeRefresh(): Promise<void> {
    if (this.monitor.needsHardRefresh()) {
      await this.post(resetHttpGifId());
      this.picIds.markReset();
      this.monitor.markRefreshed();
      return;
    }
    if (this.picIds.shouldReset()) {
      await this.post(resetHttpGifId());
      this.picIds.markReset();
    }
  }

  private async post(command: PixooCommand): Promise<PixooResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchFn(`${this.baseUrl}/post`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(command),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new PixooHttpError(response.status);
      }
      const json = (await response.json()) as PixooResponse;
      if (typeof json.error_code === "number" && json.error_code !== 0) {
        throw new PixooDeviceError(json.error_code);
      }
      return json;
    } catch (error) {
      if (error instanceof PixooHttpError || error instanceof PixooDeviceError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new PixooTimeoutError(this.timeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
