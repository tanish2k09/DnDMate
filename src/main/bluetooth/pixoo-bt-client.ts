import type { DeviceSettings } from "../../shared";
import type { DeviceSink } from "../orchestration/live-controller";
import type { Framebuffer } from "../render";
import type { BtTransport } from "./bt-transport";
import { CHANNEL, setBrightness, setChannel, setStaticImage } from "./protocol/commands";

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

  constructor(private readonly transport: BtTransport) {}

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
    if (address === this.currentAddress) return;
    if (this.transport.state !== "disconnected") {
      await this.transport.disconnect();
    }
    this.currentAddress = address;
    this.currentBrightness = null;
    if (address) {
      await this.transport.connect(address);
      // Land on the custom-image channel once after connecting; the device
      // ignores image pushes while it's on the clock channel.
      await this.transport.send(setChannel(CHANNEL.CUSTOM));
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
          await this.transport.send(setStaticImage(frame.data));
        } catch (error) {
          console.warn("PixooBtClient.push failed:", error);
          return; // bail; reconciler will recover on next settings change
        }
      }
    } finally {
      this.sending = false;
    }
  }
}
