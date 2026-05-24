/**
 * Tracks the Divoom `PicID` counter. Each animation needs a strictly-increasing
 * id; the counter is also reset periodically to sidestep the device's known
 * PicID-overflow / unresponsiveness behaviour.
 */
export class PicIdManager {
  private current: number;
  private sinceReset = 0;

  constructor(
    private readonly resetEvery: number,
    start = 1,
  ) {
    this.current = start;
  }

  /** Take the next id to use for a `SendHttpGif` animation. */
  next(): number {
    const id = this.current;
    this.current += 1;
    this.sinceReset += 1;
    return id;
  }

  /** Whether enough pushes have happened that the GIF id should be reset. */
  shouldReset(): boolean {
    return this.sinceReset >= this.resetEvery;
  }

  /** Record that the device's GIF id was reset; the counter starts over. */
  markReset(): void {
    this.sinceReset = 0;
    this.current = 1;
  }

  /** Re-seed the counter from a value the device reported via `GetHttpGifId`. */
  seed(value: number): void {
    this.current = Math.max(1, Math.floor(value) + 1);
  }

  /** The id that will be returned by the next call to {@link next}. */
  get value(): number {
    return this.current;
  }

  /** Number of pushes since the last reset. */
  get pushesSinceReset(): number {
    return this.sinceReset;
  }
}
