/**
 * Enumerate Bluetooth devices the OS has already paired with this host. We
 * deliberately do NOT trigger a fresh BT inquiry — Apple requires the user
 * to do the initial pairing in System Settings → Bluetooth, and active
 * scanning from inside the app needs entitlements we don't have for a
 * personal-use build.
 *
 * The renderer's "Setup" panel calls this through IPC. We filter to devices
 * whose name looks like a Divoom product so the dropdown stays useful even
 * if the user has dozens of paired devices (headphones, mice, etc.).
 */

import { createRequire } from "node:module";
import type { PairedDevice } from "node-bluetooth-serial-port";

/** CJS require slips past rollup so the optional native dep isn't analyzed at build time. */
const nodeRequire = createRequire(import.meta.url);

export interface ScannedDevice {
  address: string;
  name: string;
  /** True if the name pattern-matches a known Pixoo / Divoom product. */
  isPixooLike: boolean;
}

/** Patterns recognised as "almost certainly a Pixoo Max". */
const PIXOO_NAME_PATTERN = /pixoo|divoom/i;

/**
 * List paired devices. Returns an empty array (rather than throwing) when
 * the native module is unavailable — the renderer still wants to render
 * the UI in that case.
 */
export async function listPairedPixooDevices(): Promise<ScannedDevice[]> {
  let mod: typeof import("node-bluetooth-serial-port");
  try {
    mod = nodeRequire("node-bluetooth-serial-port") as typeof import("node-bluetooth-serial-port");
  } catch (error) {
    console.warn("device-scanner: native module unavailable", error);
    return [];
  }

  const serial = new mod.BluetoothSerialPort();
  const devices = await new Promise<PairedDevice[]>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve([]);
      }
    }, 5000);
    serial.listPairedDevices((list) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(list);
    });
  });

  return devices
    .map(
      (device): ScannedDevice => ({
        address: device.address,
        name: device.name,
        isPixooLike: PIXOO_NAME_PATTERN.test(device.name),
      }),
    )
    .sort((a, b) => {
      // Pixoo-likes first, then alphabetical by name.
      if (a.isPixooLike !== b.isPixooLike) return a.isPixooLike ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
