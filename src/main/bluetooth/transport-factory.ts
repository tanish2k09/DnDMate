import { createRequire } from "node:module";
import type { BtTransport } from "./bt-transport";
import { MockBluetoothTransport } from "./mock-transport";
import { RfcommTransport } from "./rfcomm-transport";

/**
 * Use a CJS `require` rather than a static or dynamic `import` so rollup
 * doesn't try to resolve `node-bluetooth-serial-port` at build time. The
 * package is optional + native; we want pure runtime resolution.
 */
const nodeRequire = createRequire(import.meta.url);

/**
 * Build the BT transport for the current run.
 *
 * Selection rules:
 *   1. `DNDMATE_FORCE_MOCK_BT=1` → always mock (used by `npm run dev:mock`
 *      so a Windows dev box can drive the full UI without hardware).
 *   2. Non-darwin platforms → mock (node-bluetooth-serial-port has no
 *      first-class Windows support, and we don't ship that path).
 *   3. Otherwise try to load `node-bluetooth-serial-port`. If the native
 *      module is missing or the rebuild against Electron's ABI failed,
 *      log loudly and fall back to mock so the app still launches.
 *
 * The mock validates every frame against the Divoom framing rules and
 * records bytes, so even the fallback path keeps the renderer preview
 * alive — the user sees "BT unavailable" in the status badge and the
 * pixels still light up on screen.
 */
export async function createBtTransport(): Promise<BtTransport> {
  if (process.env.DNDMATE_FORCE_MOCK_BT === "1") {
    console.log("transport-factory: DNDMATE_FORCE_MOCK_BT=1 → using MockBluetoothTransport");
    return new MockBluetoothTransport();
  }

  if (process.platform !== "darwin") {
    console.log(
      `transport-factory: platform=${process.platform} (no RFCOMM support) → using MockBluetoothTransport`,
    );
    return new MockBluetoothTransport();
  }

  try {
    const mod = nodeRequire(
      "node-bluetooth-serial-port",
    ) as typeof import("node-bluetooth-serial-port");
    console.log("transport-factory: loaded node-bluetooth-serial-port → using RfcommTransport");
    return new RfcommTransport(mod.BluetoothSerialPort);
  } catch (error) {
    console.warn(
      "transport-factory: failed to load node-bluetooth-serial-port " +
        "(did electron-rebuild run on this machine?). Falling back to mock.",
      error,
    );
    return new MockBluetoothTransport();
  }
}
