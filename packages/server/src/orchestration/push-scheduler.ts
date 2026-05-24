/**
 * A simple repeating ticker. The {@link LiveController} runs one at 1Hz while a
 * time-based scene (the hourglass) is active, and leaves it stopped otherwise so
 * static scenes consume no device-update budget.
 */
export class PushScheduler {
  private handle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly intervalMs: number,
    private readonly onTick: () => void,
  ) {}

  /** Begin ticking. A no-op if already running. */
  start(): void {
    if (this.handle !== null) return;
    this.handle = setInterval(() => this.onTick(), this.intervalMs);
  }

  /** Stop ticking. A no-op if already stopped. */
  stop(): void {
    if (this.handle !== null) {
      clearInterval(this.handle);
      this.handle = null;
    }
  }

  get running(): boolean {
    return this.handle !== null;
  }
}
