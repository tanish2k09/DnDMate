import type { BluetoothSerialPort } from "node-bluetooth-serial-port";
import type { BtTransport, ConnectionState, DisconnectListener } from "./bt-transport";

/**
 * Production {@link BtTransport} backed by `node-bluetooth-serial-port` —
 * speaks BT Classic RFCOMM to the Pixoo Max (channel 1 on current firmware).
 *
 * Lifecycle notes:
 *   - `connect()` does an SDP channel lookup first, then opens the socket.
 *     The "closed" event fires both when we close locally AND when the
 *     device drops the link (sleeps, moves out of range), so we lose the
 *     local/remote distinction; the listener treats every close as "lost".
 *   - `send()` serializes writes through a queue. Without that, two
 *     overlapping write() calls can interleave bytes mid-frame on macOS.
 *
 * Built lazily: the constructor takes the `BluetoothSerialPort` *class*
 * (not an instance) so {@link createBtTransport} can dynamic-import the
 * native module and fall back to mock if the rebuild failed.
 */
export class RfcommTransport implements BtTransport {
  /** Pixoo Max exposes its serial profile on RFCOMM channel 1. */
  private static readonly FALLBACK_CHANNEL = 1;

  private serial: BluetoothSerialPort | null = null;
  private listeners = new Set<DisconnectListener>();
  private currentState: ConnectionState = "disconnected";
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly SerialPortCtor: new () => BluetoothSerialPort) {}

  get state(): ConnectionState {
    return this.currentState;
  }

  async connect(address: string): Promise<void> {
    if (this.currentState === "connected") return;
    this.currentState = "connecting";

    const serial = new this.SerialPortCtor();
    const channel = await this.resolveChannel(serial, address).catch((error) => {
      this.currentState = "disconnected";
      throw new Error(`RfcommTransport.connect: SDP lookup failed: ${error.message}`);
    });

    await new Promise<void>((resolve, reject) => {
      serial.connect(
        address,
        channel,
        () => resolve(),
        (error) =>
          reject(error ?? new Error(`RfcommTransport.connect: socket open failed (${address})`)),
      );
    }).catch((error) => {
      this.currentState = "disconnected";
      throw error;
    });

    serial.on("closed", () => this.handleClose("remote"));
    serial.on("failure", (error) => {
      console.warn("RfcommTransport: socket failure", error);
      this.handleClose("error");
    });

    this.serial = serial;
    this.currentState = "connected";
  }

  async send(bytes: Uint8Array): Promise<void> {
    if (this.currentState !== "connected" || !this.serial) {
      throw new Error(`RfcommTransport.send: not connected (state=${this.currentState})`);
    }
    const serial = this.serial;
    const buffer = Buffer.from(bytes);
    // Serialize writes so frames don't interleave on the wire.
    const next = this.writeQueue.then(
      () =>
        new Promise<void>((resolve, reject) => {
          serial.write(buffer, (error) => {
            if (error) {
              console.warn(
                `RfcommTransport: write failed after ${buffer.length} byte frame:`,
                error,
              );
              reject(error);
            } else {
              resolve();
            }
          });
        }),
    );
    this.writeQueue = next.catch(() => {
      // Swallow so subsequent sends don't inherit the rejected chain.
    });
    return next;
  }

  async disconnect(): Promise<void> {
    if (this.currentState === "disconnected") return;
    const serial = this.serial;
    this.serial = null;
    this.currentState = "disconnected";
    if (serial) {
      try {
        serial.removeAllListeners("closed");
        serial.removeAllListeners("failure");
        serial.close();
      } catch (error) {
        console.warn("RfcommTransport.disconnect: close failed", error);
      }
    }
    this.emit("local");
  }

  onDisconnect(listener: DisconnectListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------------------------------------------------------------- internals

  private async resolveChannel(serial: BluetoothSerialPort, address: string): Promise<number> {
    return new Promise<number>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        // Some pairings fail SDP; fall back to the documented Pixoo channel.
        if (!settled) {
          settled = true;
          console.warn(
            `RfcommTransport: SDP lookup timed out for ${address}; ` +
              `falling back to channel ${RfcommTransport.FALLBACK_CHANNEL}`,
          );
          resolve(RfcommTransport.FALLBACK_CHANNEL);
        }
      }, 3000);
      serial.findSerialPortChannel(
        address,
        (channel) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(channel);
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(RfcommTransport.FALLBACK_CHANNEL);
        },
      );
    });
  }

  private handleClose(cause: "remote" | "error"): void {
    if (this.currentState === "disconnected") return;
    this.serial = null;
    this.currentState = "disconnected";
    this.emit(cause);
  }

  private emit(cause: "remote" | "local" | "error"): void {
    for (const listener of this.listeners) listener(cause);
  }
}
