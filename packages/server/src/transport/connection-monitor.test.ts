import { describe, expect, test } from "bun:test";
import { ConnectionMonitor } from "./connection-monitor";

describe("ConnectionMonitor", () => {
  test("starts healthy", () => {
    expect(new ConnectionMonitor().state).toBe("healthy");
  });

  test("degrades, then becomes unresponsive on repeated failures", () => {
    const monitor = new ConnectionMonitor();
    monitor.recordFailure();
    expect(monitor.state).toBe("degraded");
    monitor.recordFailure();
    expect(monitor.state).toBe("degraded");
    monitor.recordFailure();
    expect(monitor.state).toBe("unresponsive");
  });

  test("a success clears the failure streak and restores health", () => {
    const monitor = new ConnectionMonitor();
    monitor.recordFailure();
    monitor.recordFailure();
    monitor.recordSuccess();
    expect(monitor.state).toBe("healthy");
    expect(monitor.failureStreak).toBe(0);
  });

  test("flags a hard refresh once the update threshold is reached", () => {
    const monitor = new ConnectionMonitor(3);
    monitor.recordSuccess();
    monitor.recordSuccess();
    expect(monitor.needsHardRefresh()).toBe(false);
    monitor.recordSuccess();
    expect(monitor.needsHardRefresh()).toBe(true);
    monitor.markRefreshed();
    expect(monitor.needsHardRefresh()).toBe(false);
  });
});
