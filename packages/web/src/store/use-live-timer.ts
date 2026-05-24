import type { TimerSnapshot } from "@dndmate/shared";
import { useEffect, useRef, useState } from "react";

/** How often the local clock re-evaluates a running countdown. */
const TICK_MS = 250;

/**
 * Smoothly tick a running countdown on the client.
 *
 * The server only broadcasts game state on mutations, so between a `start` and a
 * `pause` no updates arrive. This hook anchors to the latest snapshot and
 * derives the remaining time from the wall clock, re-anchoring whenever a fresh
 * snapshot comes in.
 */
export function useLiveTimer(timer: TimerSnapshot | undefined): number {
  const [, forceRender] = useState(0);

  const snapshotRemaining = timer?.remainingSeconds ?? 0;
  const snapshotRunning = timer?.running ?? false;

  const anchor = useRef({
    remaining: snapshotRemaining,
    running: snapshotRunning,
    at: Date.now(),
  });

  // Re-anchor whenever a fresh snapshot arrives (its remaining time, or run state).
  useEffect(() => {
    anchor.current = {
      remaining: snapshotRemaining,
      running: snapshotRunning,
      at: Date.now(),
    };
    forceRender((n) => n + 1);
  }, [snapshotRemaining, snapshotRunning]);

  // While running, re-render a few times a second so the readout stays live.
  useEffect(() => {
    if (!snapshotRunning) return;
    const id = setInterval(() => forceRender((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [snapshotRunning]);

  if (!timer) return 0;
  if (!snapshotRunning) return snapshotRemaining;
  const elapsed = (Date.now() - anchor.current.at) / 1000;
  return Math.max(0, anchor.current.remaining - elapsed);
}
