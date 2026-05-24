import type { BtConnectionStatus } from "../../shared";
import { useApp } from "../store/app-context";

const LABELS: Record<BtConnectionStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting…",
  connected: "Connected",
  unavailable: "BT unavailable",
};

/**
 * Pill in the header showing the current Bluetooth connection state, with an
 * inline reconnect button when the link is down. The IPC connection itself
 * (renderer ↔ main) is implicit — if it dropped, the whole UI would freeze,
 * so we only surface the BT-link state.
 */
export function DeviceStatusBadge() {
  const { bt, actions } = useApp();
  const label = LABELS[bt.status];
  const detail = bt.status === "connected" && bt.address ? ` ${bt.address}` : "";
  const title = bt.error ?? undefined;
  const showRetry = bt.status === "disconnected" || bt.status === "connecting";
  return (
    <span className={`status-badge status-${bt.status}`} title={title}>
      <span>
        {label}
        {detail}
      </span>
      {showRetry && (
        <button
          type="button"
          className="status-retry"
          onClick={(event) => {
            event.stopPropagation();
            void actions.reconnectDevice();
          }}
          aria-label="Reconnect to device"
          title="Reconnect"
          disabled={bt.status === "connecting"}
        >
          ↻
        </button>
      )}
    </span>
  );
}
