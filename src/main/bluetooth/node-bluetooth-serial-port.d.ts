/**
 * Minimal type shim for `node-bluetooth-serial-port`. The published package
 * ships no type definitions and there is no `@types/...` counterpart on the
 * registry, so we declare just the subset we use.
 *
 * Source of truth for the API: https://github.com/eelcocramer/node-bluetooth-serial-port
 */

declare module "node-bluetooth-serial-port" {
  export interface PairedDeviceService {
    name: string;
    /** RFCOMM channel exposed by the service (Pixoo Max uses channel 1). */
    channel: number;
  }

  export interface PairedDevice {
    /** Colon-separated MAC, uppercase (e.g. "AA:BB:CC:DD:EE:FF"). */
    address: string;
    /** Human-readable name advertised by the device (e.g. "Pixoo-Max"). */
    name: string;
    /** Populated on macOS; some Linux backends omit this. */
    services?: PairedDeviceService[];
  }

  export class BluetoothSerialPort {
    /** Scan for in-range BT-Classic devices (emits "found" then "finished"). */
    inquire(): void;
    /** List devices the OS has already paired with this host. */
    listPairedDevices(callback: (devices: PairedDevice[]) => void): void;
    /** Resolve the RFCOMM channel an address exposes (SDP lookup). */
    findSerialPortChannel(
      address: string,
      success: (channel: number) => void,
      failure?: () => void,
    ): void;
    /** Open the RFCOMM socket on a known address + channel. */
    connect(
      address: string,
      channel: number,
      success: () => void,
      failure?: (error?: Error) => void,
    ): void;
    /** Push bytes; `bytesWritten` may be < buffer.length on partial writes. */
    write(buffer: Buffer, callback: (err: Error | null, bytesWritten: number) => void): void;
    /** Hang up the socket. */
    close(): void;
    /** True if the socket is currently open. */
    isOpen(): boolean;

    on(event: "found", listener: (address: string, name: string) => void): this;
    on(event: "finished", listener: () => void): this;
    on(event: "data", listener: (buffer: Buffer) => void): this;
    on(event: "closed", listener: () => void): this;
    on(event: "failure", listener: (err: Error) => void): this;
    removeAllListeners(event?: string): this;
  }
}
