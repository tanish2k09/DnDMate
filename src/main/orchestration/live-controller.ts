import type { DeviceSettings, GameState } from "../../shared";
import type { GameStore } from "../domain/game-store";
import { applyMutations, type Mutation } from "../domain/mutations";
import type { Framebuffer } from "../render";
import { renderScene } from "../scene";
import { PendingActionQueue } from "./action-queue";
import { profileForModel } from "./device-profile";
import { PushScheduler } from "./push-scheduler";

/** Default delay between frames when an animation plays out on commit. */
const DEFAULT_COMMIT_FRAME_MS = 200;

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
  /** Called with the latest draft frame — what the user is composing. */
  onDraftFrame: (frame: Framebuffer) => void;
  /** Called with the latest committed frame — what's actually on the device. */
  onLiveFrame: (frame: Framebuffer) => void;
  /** Called whenever the queue depth changes. */
  onPendingChange: (pending: number) => void;
  /**
   * Called with the draft state (committed + pending mutations applied) so the
   * UI can show in-progress changes. Fires alongside onDraftFrame.
   */
  onDraftState: (state: GameState) => void;
  /** Tick interval for time-based scenes; defaults to 1000ms. */
  tickIntervalMs?: number;
  /** Delay between frames when committing a multi-action queue. */
  commitFrameMs?: number;
}

/**
 * Orchestrates rendering, the device sink, and the commit-gated action queue.
 *
 * Mutation flow:
 *   1. Caller (IPC bridge) enqueues a {@link Mutation} via {@link enqueue}.
 *   2. Queue dedupes by key — multiple HP edits to the same combatant collapse
 *      to one final value.
 *   3. Draft preview re-renders as `committedState + queue applied in order`.
 *   4. The device is NOT updated until {@link commit} is called.
 *
 * Commit:
 *   - With actions queued: drain the queue and apply mutations to the store
 *     one at a time, pushing each intermediate frame to the device with a
 *     small delay.
 *   - With an empty queue: re-push the current live frame to the device. Use
 *     this to recover from a frame the device dropped without changing state.
 *
 * Scheduler bypass:
 *   - The 1Hz hourglass ticker calls {@link handleSchedulerTick} directly:
 *     those frames bypass the queue and go straight to the device.
 *
 * Bypass mutations:
 *   - Settings (brightness/host/model) and timer commands apply directly to
 *     the store via its existing imperative methods. The store-change
 *     listener then renders a fresh live frame and pushes it.
 */
export class LiveController {
  private readonly store: GameStore;
  private readonly device: DeviceSink;
  private readonly onDraftFrame: (frame: Framebuffer) => void;
  private readonly onLiveFrame: (frame: Framebuffer) => void;
  private readonly onPendingChange: (pending: number) => void;
  private readonly onDraftState: (state: GameState) => void;
  private readonly scheduler: PushScheduler;
  private readonly commitFrameMs: number;
  private readonly queue = new PendingActionQueue();
  private storeUnsubscribe: (() => void) | null = null;
  private queueUnsubscribe: (() => void) | null = null;
  private liveFrame: Framebuffer | null = null;
  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  private committing = false;

  constructor(deps: LiveControllerDeps) {
    this.store = deps.store;
    this.device = deps.device;
    this.onDraftFrame = deps.onDraftFrame;
    this.onLiveFrame = deps.onLiveFrame;
    this.onPendingChange = deps.onPendingChange;
    this.onDraftState = deps.onDraftState;
    this.commitFrameMs = deps.commitFrameMs ?? DEFAULT_COMMIT_FRAME_MS;
    this.scheduler = new PushScheduler(deps.tickIntervalMs ?? 1000, () => this.handleSchedulerTick());
  }

  /** Snapshot of the current draft state (committed + pending applied). */
  getDraftState(): GameState {
    return this.computeDraftState();
  }

  /** The most recent committed frame (or null before the first render). */
  get currentLiveFrame(): Framebuffer | null {
    return this.liveFrame;
  }

  get pendingCount(): number {
    return this.queue.size();
  }

  /** Subscribe to the store/queue and seed the device with the initial frame. */
  start(): void {
    if (this.storeUnsubscribe) return;
    this.storeUnsubscribe = this.store.onChange(() => this.handleStoreChange());
    this.queueUnsubscribe = this.queue.onChange(() => this.handleQueueChange());
    // First render is auto-committed so the device shows something immediately.
    const frame = this.renderCommitted();
    this.applyDeviceSettings();
    this.device.push(frame);
    this.liveFrame = frame;
    this.onLiveFrame(frame);
    this.onDraftFrame(frame);
    this.onDraftState(this.store.toState());
    this.onPendingChange(0);
    this.syncScheduler();
  }

  /** Unsubscribe and stop the ticker. */
  stop(): void {
    this.storeUnsubscribe?.();
    this.storeUnsubscribe = null;
    this.queueUnsubscribe?.();
    this.queueUnsubscribe = null;
    this.scheduler.stop();
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
    this.committing = false;
  }

  /** Queue a mutation for the next commit. Dedupes by mutation key. */
  enqueue(mutation: Mutation): void {
    this.queue.enqueue(mutation);
  }

  /**
   * Apply queued mutations to the device as an animation. If the queue is
   * empty, re-push the current live frame instead (useful as a manual
   * "redraw" when the device dropped a frame).
   */
  commit(): void {
    if (this.committing) return;
    const mutations = this.queue.drain();
    if (mutations.length === 0) {
      if (this.liveFrame) {
        this.applyDeviceSettings();
        this.device.push(this.liveFrame);
        this.onLiveFrame(this.liveFrame);
      }
      return;
    }
    this.committing = true;
    this.applyDeviceSettings();
    this.playSequence(mutations);
  }

  /** Drop every queued mutation; the live frame is unchanged. */
  discard(): void {
    this.queue.clear();
  }

  // ---------------------------------------------------------------- internals

  /**
   * Settings and timer mutations apply directly to the store (bypassing the
   * queue), and the resulting store change comes here. We push the new
   * committed frame live unless we're mid-commit (in which case we're already
   * pushing per-mutation).
   */
  private handleStoreChange(): void {
    this.syncScheduler();
    this.applyDeviceSettings();
    if (this.committing) return;
    const frame = this.renderCommitted();
    this.liveFrame = frame;
    this.device.push(frame);
    this.onLiveFrame(frame);
    // Re-render the draft preview too — committed change shifts the base the
    // pending mutations apply on top of.
    this.broadcastDraft();
  }

  /** Queue changed (enqueue / dedup / clear) — re-render the draft preview. */
  private handleQueueChange(): void {
    this.onPendingChange(this.queue.size());
    this.broadcastDraft();
  }

  private broadcastDraft(): void {
    const state = this.computeDraftState();
    const frame = this.renderState(state);
    this.onDraftFrame(frame);
    this.onDraftState(state);
  }

  private computeDraftState(): GameState {
    const live = this.store.toState();
    const pending = this.queue.list();
    if (pending.length === 0) return live;
    const persisted = {
      party: live.party,
      enemies: live.enemies,
      device: live.device,
      activeScene: live.activeScene,
    };
    const draftPersisted = applyMutations(persisted, pending);
    return { ...draftPersisted, timer: live.timer };
  }

  private handleSchedulerTick(): void {
    // Scheduler ticks (hourglass countdown) bypass the queue and go live.
    const frame = this.renderCommitted();
    this.applyDeviceSettings();
    this.device.push(frame);
    this.liveFrame = frame;
    this.onLiveFrame(frame);
    if (this.queue.isEmpty()) {
      this.onDraftFrame(frame);
      this.onDraftState(this.store.toState());
    }
  }

  private playSequence(mutations: Mutation[]): void {
    if (mutations.length === 0) {
      this.committing = false;
      if (this.liveFrame) this.onDraftFrame(this.liveFrame);
      this.onDraftState(this.store.toState());
      return;
    }
    const [head, ...rest] = mutations;
    // Apply to the store first (mutates committed state). The resulting
    // store-change event is ignored because `this.committing` is true.
    this.store.applyMutation(head);
    const frame = this.renderCommitted();
    this.liveFrame = frame;
    this.device.push(frame);
    this.onLiveFrame(frame);
    // Reflect committed change in the UI as the animation plays out.
    this.onDraftFrame(frame);
    this.onDraftState(this.store.toState());
    if (rest.length === 0) {
      this.committing = false;
      return;
    }
    this.commitTimer = setTimeout(() => this.playSequence(rest), this.commitFrameMs);
  }

  private applyDeviceSettings(): void {
    this.device.update(this.store.toState().device);
  }

  private renderCommitted(): Framebuffer {
    return this.renderState(this.store.toState());
  }

  private renderState(state: GameState): Framebuffer {
    const profile = profileForModel(state.device.model);
    return renderScene({
      width: profile.width,
      height: profile.height,
      state,
      now: Date.now(),
    });
  }

  /** Run the 1Hz ticker only while a live countdown (or its time-up blink) is showing. */
  private syncScheduler(): void {
    const { activeScene, timer } = this.store.toState();
    const needsTick = activeScene === "hourglass" && (timer.running || timer.remainingSeconds <= 0);
    if (needsTick) this.scheduler.start();
    else this.scheduler.stop();
  }
}
