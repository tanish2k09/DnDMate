import type { BtConnectionStatus } from "../../shared";
import { useApp } from "../store/app-context";

const LABELS: Record<BtConnectionStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting…",
  connected: "Connected",
  unavailable: "BT unavailable",
};

/**
 * Pill in the header showing the current Bluetooth connection state. The
 * IPC connection itself (renderer ↔ main) is implicit — if it dropped, the
 * whole UI would freeze, so we only surface the BT-link state.
 */
export function DeviceStatusBadge() {
  const { bt } = useApp();
  const label = LABELS[bt.status];
  const detail = bt.status === "connected" && bt.address ? ` ${bt.address}` : "";
  const title = bt.error ?? undefined;
  return (
    <span className={`status-badge status-${bt.status}`} title={title}>
      {label}
      {detail}
    </span>
  );
}
