import type { BtConnectionStatus, BtStatusMessage, DeviceSettings } from "../../shared";
import type { DeviceSink } from "../orchestration/live-controller";
import type { Framebuffer } from "../render";
import type { BtTransport } from "./bt-transport";
import {
  CHANNEL,
  encodePaletteFrame,
  setBrightness,
  setChannel,
  setStaticImage,
} from "./protocol/commands";

type StatusListener = (status: BtStatusMessage) => void;

/**
 * Adapts the {@link BtTransport} byte channel into the {@link DeviceSink}
 * interface the orchestration layer hands framebuffers to.
 *
 * Responsibilities:
 *   - Reconcile the current connection with the latest device settings: open
 *     a BT connection when the address appears, close it when it clears,
 *     reopen when the address changes.
 *   - On each frame, encode + queue a static-image push. Frames that arrive
 *     while a previous send is still in flight are coalesced: the orchestration
 *     layer only cares about the latest pixels.
 *   - Push brightness changes lazily, only when the value actually moves.
 *
 * Errors during connect/send are logged but do NOT propagate — the renderer
 * preview is the user's ground truth, and we don't want a flaky BT link to
 * crash the app. M6 surfaces connection state to the UI as a status badge.
 */
export class PixooBtClient implements DeviceSink {
  private currentAddress: string | null = null;
  private currentBrightness: number | null = null;
  /** Frame buffered for the next available send window (coalesced). */
  private pendingFrame: Framebuffer | null = null;
  /** True while a send() is in flight; new frames overwrite pendingFrame. */
  private sending = false;
  private reconciling: Promise<void> = Promise.resolve();
  private status: BtStatusMessage;
  private readonly statusListeners = new Set<StatusListener>();

  constructor(private readonly transport: BtTransport) {
    this.status = { type: "bt-status", status: "disconnected", address: null, error: null };
    this.transport.onDisconnect((cause) => {
      this.setStatus(
        "disconnected",
        this.currentAddress,
        cause === "error" ? "link dropped" : null,
      );
    });
  }

  /** Latest known BT status (useful for IPC snapshot). */
  get currentStatus(): BtStatusMessage {
    return this.status;
  }

  /** Subscribe to BT status changes; returns an unsubscribe fn. */
  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Mark the BT transport as unavailable (native module failed to load, etc). */
  markUnavailable(reason: string): void {
    this.setStatus("unavailable", null, reason);
  }

  /** Called by LiveController whenever device settings change. */
  update(settings: DeviceSettings): void {
    const address = settings.host?.trim() || null;
    // Chain reconciliation work so simultaneous address changes don't race,
    // and kick drain() after each step so frames pushed before connect
    // completes still go out once the link comes up.
    this.reconciling = this.reconciling
      .then(() => this.reconcileAddress(address))
      .then(() => this.reconcileBrightness(settings.brightness))
      .then(() => this.drain())
      .catch((error) => {
        console.warn("PixooBtClient.update failed:", error);
      });
  }

  /** Called by LiveController with each freshly rendered frame. */
  push(frame: Framebuffer): void {
    this.pendingFrame = frame;
    void this.drain();
  }

  /**
   * Push every frame sequentially, awaiting each transport.send, and return
   * per-frame timings. Bypasses coalescing — used by the benchmark UI to
   * measure real-world frame throughput against the device.
   */
  async benchmark(
    frames: readonly Framebuffer[],
    options: { minIntervalMs?: number; bytesPerSec?: number } = {},
  ): Promise<{
    samples: Array<{ paletteCount: number; payloadBytes: number; ms: number }>;
    error: string | null;
  }> {
    if (this.transport.state !== "connected") {
      return { samples: [], error: "not connected" };
    }
    const minIntervalMs = options.minIntervalMs ?? 0;
    const bytesPerSec = options.bytesPerSec ?? 0;
    const samples: Array<{ paletteCount: number; payloadBytes: number; ms: number }> = [];
    for (const frame of frames) {
      const { paletteCount } = encodePaletteFrame(frame);
      const bytes = setStaticImage(frame);
      const startedAt = performance.now();
      try {
        await this.transport.send(bytes);
      } catch (error) {
        // Keep the samples we already collected so the UI can show how far we
        // got before the device dropped the link.
        return {
          samples,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      const sendMs = performance.now() - startedAt;
      samples.push({ paletteCount, payloadBytes: bytes.length, ms: sendMs });
      // Pace from frame-start to frame-start. Large frames need more time to
      // decode on the device, so we honor the larger of (a) the frame-rate cap
      // and (b) a byte-rate cap that scales with payload size.
      const byteBudgetMs = bytesPerSec > 0 ? (bytes.length / bytesPerSec) * 1000 : 0;
      const targetMs = Math.max(minIntervalMs, byteBudgetMs);
      const remaining = targetMs - sendMs;
      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }
    }
    return { samples, error: null };
  }

  /**
   * Re-attempt the BT connection with the currently bound address. No-op when
   * no device is bound or BT is unavailable. Used by the UI's "Reconnect"
   * button to recover from a device that dropped (e.g., timed out, slept).
   */
  reconnect(): void {
    this.reconciling = this.reconciling
      .then(async () => {
        const address = this.currentAddress;
        if (!address || this.status.status === "unavailable") return;
        if (this.transport.state !== "disconnected") {
          try {
            await this.transport.disconnect();
          } catch {
            // about to reconnect — ignore teardown errors
          }
        }
        this.currentAddress = null;
        this.currentBrightness = null;
        await this.reconcileAddress(address);
      })
      .then(() => this.drain())
      .catch((error) => {
        console.warn("PixooBtClient.reconnect failed:", error);
      });
  }

  /** Disconnect cleanly; safe to call multiple times. */
  async dispose(): Promise<void> {
    try {
      await this.transport.disconnect();
    } finally {
      this.currentAddress = null;
      this.currentBrightness = null;
      this.pendingFrame = null;
    }
  }

  // ---------------------------------------------------------------- internals

  private async reconcileAddress(address: string | null): Promise<void> {
    if (this.status.status === "unavailable") return;
    if (address === this.currentAddress) return;
    if (this.transport.state !== "disconnected") {
      await this.transport.disconnect();
    }
    this.currentAddress = address;
    this.currentBrightness = null;
    if (!address) {
      this.setStatus("disconnected", null, null);
      return;
    }
    this.setStatus("connecting", address, null);
    try {
      await this.transport.connect(address);
      // Land on the custom-image channel once after connecting; the device
      // ignores image pushes while it's on the clock channel.
      await this.transport.send(setChannel(CHANNEL.CUSTOM));
      this.setStatus("connected", address, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus("disconnected", address, message);
      throw error;
    }
  }

  private async reconcileBrightness(brightness: number): Promise<void> {
    if (this.transport.state !== "connected") return;
    if (brightness === this.currentBrightness) return;
    await this.transport.send(setBrightness(brightness));
    this.currentBrightness = brightness;
  }

  private async drain(): Promise<void> {
    if (this.sending) return;
    if (this.transport.state !== "connected") return;
    this.sending = true;
    try {
      while (this.pendingFrame) {
        const frame = this.pendingFrame;
        this.pendingFrame = null;
        try {
          await this.transport.send(setStaticImage(frame));
        } catch (error) {
          console.warn("PixooBtClient.push failed:", error);
          return; // bail; reconciler will recover on next settings change
        }
      }
    } finally {
      this.sending = false;
    }
  }

  private setStatus(
    status: BtConnectionStatus,
    address: string | null,
    error: string | null,
  ): void {
    const next: BtStatusMessage = { type: "bt-status", status, address, error };
    // Skip the notification if nothing material has changed.
    if (
      next.status === this.status.status &&
      next.address === this.status.address &&
      next.error === this.status.error
    ) {
      return;
    }
    this.status = next;
    for (const listener of this.statusListeners) listener(next);
  }
}
