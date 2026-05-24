import type { DeviceSettings } from "@shared";
import type { GameStore } from "../domain/game-store";
import type { Framebuffer } from "../render";
import { renderScene } from "../scene";
import { profileForModel } from "./device-profile";
import { PushScheduler } from "./push-scheduler";

/** A destination for rendered frames — the real device, or a test double. */
export interface DeviceSink {
  /** Reconcile the device connection with the latest settings. */
  update(settings: DeviceSettings): void;
  /** Display a frame on the device. */
  push(frame: Framebuffer): void;
}

export interface LiveControllerDeps {
  store: GameStore;
  device: DeviceSink;
  /** Called with every rendered frame, for the browser preview. */
  onFrame: (frame: Framebuffer) => void;
  /** Tick interval for time-based scenes; defaults to 1000ms. */
  tickIntervalMs?: number;
}

/**
 * The heartbeat of the app. It watches the {@link GameStore}, renders the active
 * scene whenever the state changes, and — for the hourglass — re-renders once a
 * second so the countdown stays live. Every frame is sent to the browser
 * preview and to the device.
 */
export class LiveController {
  private readonly store: GameStore;
  private readonly device: DeviceSink;
  private readonly onFrame: (frame: Framebuffer) => void;
  private readonly scheduler: PushScheduler;
  private unsubscribe: (() => void) | null = null;

  constructor(deps: LiveControllerDeps) {
    this.store = deps.store;
    this.device = deps.device;
    this.onFrame = deps.onFrame;
    this.scheduler = new PushScheduler(deps.tickIntervalMs ?? 1000, () => this.render());
  }

  /** Subscribe to the store and render the first frame. */
  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.store.onChange(() => this.handleStateChange());
    this.handleStateChange();
  }

  /** Unsubscribe and stop the ticker. */
  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.scheduler.stop();
  }

  private handleStateChange(): void {
    this.syncScheduler();
    this.render();
  }

  /** Run the 1Hz ticker only while a live countdown (or its time-up blink) is showing. */
  private syncScheduler(): void {
    const { activeScene, timer } = this.store.toState();
    const needsTick = activeScene === "hourglass" && (timer.running || timer.remainingSeconds <= 0);
    if (needsTick) {
      this.scheduler.start();
    } else {
      this.scheduler.stop();
    }
  }

  private render(): void {
    const state = this.store.toState();
    this.device.update(state.device);
    const profile = profileForModel(state.device.model);
    const frame = renderScene({
      width: profile.width,
      height: profile.height,
      state,
      now: Date.now(),
    });
    this.onFrame(frame);
    this.device.push(frame);
  }
}
