export type ConnectionHealth = "healthy" | "degraded" | "unresponsive";

/** Failures in a row before the connection is considered fully unresponsive. */
const UNRESPONSIVE_AFTER_FAILURES = 3;

/** Default cumulative-update count that triggers a precautionary hard refresh. */
const DEFAULT_HARD_REFRESH_THRESHOLD = 250;

/**
 * Tracks device connection health.
 *
 * Divoom devices grow unresponsive after a few hundred cumulative updates, so
 * the monitor also reports when a precautionary "hard refresh" is due.
 */
export class ConnectionMonitor {
  private health: ConnectionHealth = "healthy";
  private consecutiveFailures = 0;
  private cumulativeUpdates = 0;

  constructor(private readonly hardRefreshThreshold = DEFAULT_HARD_REFRESH_THRESHOLD) {}

  /** Record a successful update. */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.cumulativeUpdates += 1;
    this.health = "healthy";
  }

  /** Record a failed request. */
  recordFailure(): void {
    this.consecutiveFailures += 1;
    this.health =
      this.consecutiveFailures >= UNRESPONSIVE_AFTER_FAILURES ? "unresponsive" : "degraded";
  }

  /** Whether enough updates have accumulated to warrant a hard refresh. */
  needsHardRefresh(): boolean {
    return this.cumulativeUpdates >= this.hardRefreshThreshold;
  }

  /** Record that a hard refresh happened; the cumulative counter starts over. */
  markRefreshed(): void {
    this.cumulativeUpdates = 0;
  }

  get state(): ConnectionHealth {
    return this.health;
  }

  get updateCount(): number {
    return this.cumulativeUpdates;
  }

  get failureStreak(): number {
    return this.consecutiveFailures;
  }
}
