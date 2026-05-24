import type { BtTransport } from "./bt-transport";
import { MockBluetoothTransport } from "./mock-transport";

/**
 * Pick the BT transport for the current run.
 *
 * Today (M3): always {@link MockBluetoothTransport} — the mock validates every
 * frame against the Divoom framing rules and records bytes, so the renderer
 * preview plus the recorded byte stream are the user-visible output. M4 adds
 * `RfcommTransport` (node-bluetooth-serial-port) on macOS and switches this
 * factory to pick it by default, with `DNDMATE_FORCE_MOCK_BT=1` forcing mock.
 */
export function createBtTransport(): BtTransport {
  return new MockBluetoothTransport();
}
