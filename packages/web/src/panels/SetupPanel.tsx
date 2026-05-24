import type { DeviceModel } from "@dndmate/shared";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useApp } from "../store/app-context";

/** Wait this long after the brightness slider settles before committing it. */
const BRIGHTNESS_DEBOUNCE_MS = 300;

/** The setup panel: device address, model, and brightness. */
export function SetupPanel() {
  const { state, actions } = useApp();
  const device = state?.device;
  const deviceHost = device?.host ?? "";
  const deviceBrightness = device?.brightness ?? 75;

  const [host, setHost] = useState(deviceHost);
  const [brightness, setBrightness] = useState(deviceBrightness);
  const brightnessTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keep the local draft in sync when the server reports new device settings.
  useEffect(() => {
    setHost(deviceHost);
    setBrightness(deviceBrightness);
  }, [deviceHost, deviceBrightness]);

  if (!device) {
    return (
      <div className="panel">
        <p className="empty-note">Connecting to the server…</p>
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

  return (
    <div className="panel">
      <h2 className="section-title">Device</h2>

      <form className="field" onSubmit={saveHost}>
        <label className="field-label" htmlFor="device-host">
          Pixoo IP address
        </label>
        <div className="field-row">
          <input
            id="device-host"
            className="text-input"
            placeholder="192.168.1.50"
            value={host}
            onChange={(event) => setHost(event.target.value)}
          />
          <button type="submit" className="button button-primary">
            Save
          </button>
        </div>
        <p className="field-hint">Leave blank to run preview-only, with no hardware.</p>
      </form>

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
