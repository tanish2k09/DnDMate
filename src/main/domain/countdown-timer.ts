import type { TimerSnapshot } from "@shared";

const DEFAULT_DURATION_SECONDS = 60;

/**
 * A pausable countdown. The remaining time is always derived from the wall
 * clock, so a {@link snapshot} taken at any moment is accurate without the
 * timer having to tick.
 */
export class CountdownTimer {
  private durationSeconds = DEFAULT_DURATION_SECONDS;
  private remainingSeconds = DEFAULT_DURATION_SECONDS;
  private running = false;
  private startedAt: number | null = null;

  /** Start a fresh countdown of `seconds`, running from `now`. */
  start(seconds: number, now: number): void {
    this.durationSeconds = Math.max(1, Math.round(seconds) || DEFAULT_DURATION_SECONDS);
    this.remainingSeconds = this.durationSeconds;
    this.running = true;
    this.startedAt = now;
  }

  /** Pause the countdown, banking the remaining time. */
  pause(now: number): void {
    if (!this.running) return;
    this.remainingSeconds = this.computeRemaining(now);
    this.running = false;
    this.startedAt = null;
  }

  /** Resume a paused countdown that still has time left. */
  resume(now: number): void {
    if (this.running || this.remainingSeconds <= 0) return;
    this.running = true;
    this.startedAt = now;
  }

  /** Stop and restore the countdown to its full configured duration. */
  reset(): void {
    this.remainingSeconds = this.durationSeconds;
    this.running = false;
    this.startedAt = null;
  }

  /** Add (or, with a negative delta, subtract) time without changing run state. */
  addSeconds(delta: number, now: number): void {
    const remaining = this.computeRemaining(now);
    this.remainingSeconds = Math.max(0, remaining + delta);
    if (this.running) {
      this.startedAt = now;
    }
  }

  /** A serialisable snapshot of the timer as of `now`. */
  snapshot(now: number): TimerSnapshot {
    const remaining = this.computeRemaining(now);
    return {
      durationSeconds: this.durationSeconds,
      remainingSeconds: remaining,
      running: this.running && remaining > 0,
    };
  }

  private computeRemaining(now: number): number {
    if (!this.running || this.startedAt === null) {
      return this.remainingSeconds;
    }
    const elapsed = (now - this.startedAt) / 1000;
    return Math.max(0, this.remainingSeconds - elapsed);
  }
}
