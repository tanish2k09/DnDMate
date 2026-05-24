import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type {
  BenchmarkResult,
  DeviceModel,
  SavedSnapshotMetadata,
  ScannedDevice,
} from "../../shared";
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
          <button
            type="button"
            className="button"
            onClick={() => actions.reconnectDevice()}
            disabled={btUnavailable || !deviceHost || bt.status === "connecting"}
            title={
              deviceHost
                ? "Re-attempt the BT connection to the bound device"
                : "Bind a device first"
            }
          >
            {bt.status === "connecting" ? "Connecting…" : "Reconnect"}
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

      <SavedSessionsSection />
      <FrameRateBenchmarkSection />
    </div>
  );
}

function FrameRateBenchmarkSection() {
  const { actions, bt } = useApp();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const connected = bt.status === "connected";

  const run = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      setResult(await actions.runFrameBenchmark());
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        samples: [],
        totalMs: 0,
        avgMs: 0,
        fps: 0,
      });
    } finally {
      setRunning(false);
    }
  };

  // Bucket samples by their (rounded) palette size so the table shows the cost
  // curve at a glance: tiny solid frames vs near-max-palette photographic ones.
  // We aggregate even on failure so a partial-failure run still surfaces what
  // throughput we observed before the link dropped.
  const buckets = result && result.samples.length > 0 ? aggregateByPalette(result.samples) : [];
  const totalBytesPushed = result?.samples.reduce((sum, s) => sum + s.payloadBytes, 0) ?? 0;

  return (
    <div className="field">
      <h2 className="section-title">Frame rate</h2>
      <p className="field-hint">
        Pushes test frames at varying palette sizes, throttled to a 20 KB/s byte budget (with a
        10fps cap for small frames) so 1024-color frames don't overwhelm the device's decode
        pipeline. The ms/frame column shows pure send time excluding throttle waits.
      </p>
      <div className="button-row">
        <button
          type="button"
          className="button"
          onClick={run}
          disabled={running || !connected}
          title={connected ? "Push timed frames at multiple palette sizes" : "Connect a device first"}
        >
          {running ? "Running…" : "Run frame-rate benchmark"}
        </button>
      </div>
      {result?.error && (
        <p className="field-hint">
          <strong>Write failed:</strong> {result.error}.{" "}
          {result.samples.length > 0 && (
            <>
              Pushed {result.samples.length} frames (
              {(totalBytesPushed / 1024).toFixed(1)} KB) before the link dropped — likely the
              device's per-session push budget.
            </>
          )}
        </p>
      )}
      {result && result.samples.length > 0 && (
        <div className="benchmark-result">
          <p className="benchmark-summary">
            {result.samples.length} frames pushed in {result.totalMs.toFixed(0)} ms (
            {(totalBytesPushed / 1024).toFixed(1)} KB total).
            {result.avgMs > 0 && (
              <>
                {" "}Average <strong>{result.avgMs.toFixed(1)} ms/frame</strong>.
              </>
            )}
          </p>
          <table className="benchmark-table">
            <thead>
              <tr>
                <th>Palette</th>
                <th>Payload</th>
                <th>N</th>
                <th>ms/frame</th>
                <th>fps</th>
                <th>KB/s</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.paletteCount}>
                  <td>{b.paletteCount}</td>
                  <td>{b.payloadBytes} B</td>
                  <td>{b.count}</td>
                  <td>{b.avgMs.toFixed(1)}</td>
                  <td>{b.fps.toFixed(1)}</td>
                  <td>{b.kbps.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="field-hint">
            Tiny frames can finish in microseconds when they fit in the kernel socket buffer; trust
            the larger-palette rows for the true radio rate.
          </p>
        </div>
      )}
    </div>
  );
}

function aggregateByPalette(
  samples: ReadonlyArray<{ paletteCount: number; payloadBytes: number; ms: number }>,
): Array<{
  paletteCount: number;
  payloadBytes: number;
  count: number;
  avgMs: number;
  fps: number;
  kbps: number;
}> {
  const groups = new Map<number, { ms: number[]; bytes: number }>();
  for (const s of samples) {
    const entry = groups.get(s.paletteCount) ?? { ms: [], bytes: s.payloadBytes };
    entry.ms.push(s.ms);
    entry.bytes = Math.max(entry.bytes, s.payloadBytes);
    groups.set(s.paletteCount, entry);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([paletteCount, { ms, bytes }]) => {
      const totalMs = ms.reduce((sum, n) => sum + n, 0);
      const avgMs = totalMs / ms.length;
      const fps = avgMs > 0 ? 1000 / avgMs : 0;
      // KB/s is bucket bytes ÷ bucket wall time — the saturating measurement.
      const kbps = totalMs > 0 ? (bytes * ms.length) / totalMs : 0;
      return { paletteCount, payloadBytes: bytes, count: ms.length, avgMs, fps, kbps };
    });
}

function SavedSessionsSection() {
  const { actions } = useApp();
  const [slots, setSlots] = useState<SavedSnapshotMetadata[]>([]);
  const [draftName, setDraftName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSlots(await actions.listSnapshots());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, [actions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const meta = await actions.saveSnapshot(draftName);
      setDraftName("");
      setStatus(`Saved "${meta.name}".`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const onLoad = async (slot: SavedSnapshotMetadata) => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const ok = await actions.loadSnapshot(slot.id);
      setStatus(ok ? `Loaded "${slot.name}".` : "Load failed — file may be corrupted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (slot: SavedSnapshotMetadata) => {
    if (busy) return;
    if (!confirm(`Delete "${slot.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setStatus(null);
    try {
      await actions.deleteSnapshot(slot.id);
      setStatus(`Deleted "${slot.name}".`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await actions.exportSnapshot(draftName || "session");
      if (result.error) setStatus(result.error);
      else if (result.ok) setStatus(`Exported to ${result.path}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await actions.importSnapshot();
      if (result.error) setStatus(result.error);
      else if (result.ok && result.snapshot) {
        setStatus(`Imported "${result.snapshot.name}" as a new slot.`);
        await refresh();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <h2 className="section-title">
        Saved sessions <span className="count">{slots.length}</span>
      </h2>

      <form className="add-form" onSubmit={onSave}>
        <input
          className="text-input"
          type="text"
          placeholder="Session name"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          disabled={busy}
        />
        <button type="submit" className="button button-primary" disabled={busy}>
          Save current
        </button>
      </form>

      {slots.length === 0 ? (
        <p className="empty-note">No saved sessions yet.</p>
      ) : (
        <ul className="snapshot-list">
          {slots.map((slot) => (
            <li key={slot.id} className="snapshot-item">
              <div className="snapshot-info">
                <span className="snapshot-name">{slot.name}</span>
                <span className="snapshot-time">{formatTimestamp(slot.savedAt)}</span>
              </div>
              <div className="snapshot-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => onLoad(slot)}
                  disabled={busy}
                >
                  Load
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => onDelete(slot)}
                  disabled={busy}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="button-row">
        <button type="button" className="button" onClick={onExport} disabled={busy}>
          Export to file…
        </button>
        <button type="button" className="button" onClick={onImport} disabled={busy}>
          Import from file…
        </button>
      </div>

      {status && <p className="field-hint">{status}</p>}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
