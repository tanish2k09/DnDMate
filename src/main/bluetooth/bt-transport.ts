/**
 * The Bluetooth transport seam. {@link RfcommTransport} is the production
 * implementation built on `node-bluetooth-serial-port`; {@link MockBluetoothTransport}
 * is the in-memory double used for unit tests + Windows-dev runs without
 * hardware.
 */

export type ConnectionState = "disconnected" | "connecting" | "connected";

export type DisconnectListener = (cause: "remote" | "local" | "error") => void;

export interface BtTransport {
  /** Connect to a paired device by MAC address. Idempotent on the current address. */
  connect(address: string): Promise<void>;
  /** Push pre-framed bytes to the device. Resolves once the OS hands the bytes off. */
  send(bytes: Uint8Array): Promise<void>;
  /** Close the connection if open. Safe to call from any state. */
  disconnect(): Promise<void>;
  /** Current connection state. */
  readonly state: ConnectionState;
  /** Subscribe to disconnect events; returns an unsubscribe fn. */
  onDisconnect(listener: DisconnectListener): () => void;
}
