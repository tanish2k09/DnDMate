import type { ConnectionStatus } from "../api/ipc-client";
import { useApp } from "../store/app-context";

const LABELS: Record<ConnectionStatus, string> = {
  connecting: "Connecting",
  open: "Connected",
  closed: "Offline",
};

/** A small pill showing whether the browser is connected to the server. */
export function DeviceStatusBadge() {
  const { status } = useApp();
  return <span className={`status-badge status-${status}`}>{LABELS[status]}</span>;
}
