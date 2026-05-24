import type { BtTransport, ConnectionState, DisconnectListener } from "./bt-transport";
import { decodeFrame } from "./protocol/framing";

/**
 * An in-memory {@link BtTransport} that records every byte sent so tests can
 * assert exact wire output. The transport validates that each `send()` call
 * carries a well-framed Divoom packet (start/length/checksum/end), so a bad
 * encoder fails fast in unit tests rather than going silent on real hardware.
 *
 * Also used in `npm run dev:mock` so the app can run end-to-end on a Windows
 * dev box with no Pixoo paired — the renderer preview still updates.
 */
export class MockBluetoothTransport implements BtTransport {
  /** Every frame ever sent, in order, including bytes that fail validation. */
  readonly sent: Uint8Array[] = [];
  private listeners = new Set<DisconnectListener>();
  private currentAddress: string | null = null;
  private currentState: ConnectionState = "disconnected";

  get state(): ConnectionState {
    return this.currentState;
  }

  /** The last MAC the test connected to (helpful for asserting reconnect logic). */
  get address(): string | null {
    return this.currentAddress;
  }

  async connect(address: string): Promise<void> {
    this.currentState = "connecting";
    this.currentAddress = address;
    // No real I/O; flip to connected on the next tick to mimic async settle.
    await Promise.resolve();
    this.currentState = "connected";
  }

  async send(bytes: Uint8Array): Promise<void> {
    if (this.currentState !== "connected") {
      throw new Error(`MockBluetoothTransport.send: not connected (state=${this.currentState})`);
    }
    const result = decodeFrame(bytes);
    if (!result.ok) {
      throw new Error(`MockBluetoothTransport.send: malformed frame (${result.reason})`);
    }
    this.sent.push(bytes);
  }

  async disconnect(): Promise<void> {
    if (this.currentState === "disconnected") return;
    this.currentState = "disconnected";
    this.emitDisconnect("local");
  }

  onDisconnect(listener: DisconnectListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Test helper: simulate a remote/error disconnect. */
  simulateDisconnect(cause: "remote" | "error"): void {
    if (this.currentState === "disconnected") return;
    this.currentState = "disconnected";
    this.emitDisconnect(cause);
  }

  /** Test helper: forget recorded frames. */
  clear(): void {
    this.sent.length = 0;
  }

  private emitDisconnect(cause: "remote" | "local" | "error"): void {
    for (const listener of this.listeners) listener(cause);
  }
}
