import { type FormEvent, useEffect, useRef, useState } from "react";
import type { DeviceModel, ScannedDevice } from "../../shared";
import { useApp } from "../store/app-context";

/** Wait this long after the brightness slider settles before committing it. */
const BRIGHTNESS_DEBOUNCE_MS = 300;

/** The setup panel: device address (BT MAC), model, brightness. */
export function SetupPanel() {
  const { state, bt, actions } = useApp();
  const device = state?.device;
  const deviceHost = device?.host ?? "";
  const deviceBrightness = device?.brightness ?? 75;

  const [host, setHost] = useState(deviceHost);
  const [brightness, setBrightness] = useState(deviceBrightness);
  const brightnessTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [scanned, setScanned] = useState<ScannedDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Keep the local draft in sync when main reports new device settings.
  useEffect(() => {
    setHost(deviceHost);
    setBrightness(deviceBrightness);
  }, [deviceHost, deviceBrightness]);

  if (!device) {
    return (
      <div className="panel">
        <p className="empty-note">Connecting…</p>
      </div>
    );
  }

  const saveHost = (event: FormEvent) => {
    event.preventDefault();
    actions.updateSettings({ host: host.trim() || null });
  };

  const onBrightnessChange = (value: number) => {
    setBrightness(value);
    if (brightnessTimer.current) clearTimeout(brightnessTimer.current);
    brightnessTimer.current = setTimeout(() => {
      actions.updateSettings({ brightness: value });
    }, BRIGHTNESS_DEBOUNCE_MS);
  };

  const onScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      const devices = await actions.scanDevices();
      setScanned(devices);
      if (devices.length === 0) {
        setScanError(
          "No paired Bluetooth devices found. Pair the Pixoo Max in macOS " +
            "System Settings → Bluetooth first, then scan again.",
        );
      }
    } catch (error) {
      setScanError(error instanceof Error ? error.message : String(error));
    } finally {
      setScanning(false);
    }
  };

  const btUnavailable = bt.status === "unavailable";

  return (
    <div className="panel">
      <h2 className="section-title">Device</h2>

      {btUnavailable && (
        <p className="field-hint" role="status">
          Bluetooth unavailable on this build: {bt.error}. The preview still renders; pair on macOS
          to drive the Pixoo Max.
        </p>
      )}

      <form className="field" onSubmit={saveHost}>
        <label className="field-label" htmlFor="device-host">
          Pixoo Bluetooth address
        </label>
        <div className="field-row">
          <input
            id="device-host"
            className="text-input"
            placeholder="AA:BB:CC:DD:EE:FF"
            value={host}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setHost(event.target.value)}
            disabled={btUnavailable}
          />
          <button type="submit" className="button button-primary" disabled={btUnavailable}>
            Save
          </button>
        </div>
        <p className="field-hint">
          Pair the Pixoo Max in macOS System Settings → Bluetooth first, then paste its MAC here or
          scan below. Leave blank for preview-only.
        </p>
      </form>

      <div className="field">
        <div className="field-row">
          <button
            type="button"
            className="button"
            onClick={onScan}
            disabled={btUnavailable || scanning}
          >
            {scanning ? "Scanning…" : "Scan paired devices"}
          </button>
        </div>
        {scanError && <p className="field-hint">{scanError}</p>}
        {scanned.length > 0 && (
          <ul className="device-list">
            {scanned.map((entry) => (
              <li key={entry.address}>
                <button
                  type="button"
                  className={`device-list-item ${entry.isPixooLike ? "device-list-item-recommended" : ""}`}
                  onClick={() => {
                    setHost(entry.address);
                    actions.updateSettings({ host: entry.address });
                  }}
                >
                  <span className="device-name">{entry.name || "(unnamed)"}</span>
                  <span className="device-address">{entry.address}</span>
                  {entry.isPixooLike && <span className="device-badge">Pixoo</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="device-model">
          Model
        </label>
        <select
          id="device-model"
          className="select-input"
          value={device.model}
          onChange={(event) => actions.updateSettings({ model: event.target.value as DeviceModel })}
        >
          <option value="pixoo-max">Pixoo Max — 32×32</option>
          <option value="pixoo-64">Pixoo 64 — 64×64</option>
        </select>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="device-brightness">
          Brightness — {brightness}%
        </label>
        <input
          id="device-brightness"
          className="range-input"
          type="range"
          min="0"
          max="100"
          value={brightness}
          onChange={(event) => onBrightnessChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
