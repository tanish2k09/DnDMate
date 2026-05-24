import { BrowserWindow, dialog, ipcMain } from "electron";
import {
  type AddCombatantInput,
  type BenchmarkResult,
  type BtStatusMessage,
  type DeviceSettingsPatch,
  IpcChannel,
  type PreviewMessage,
  type SavedSnapshotMetadata,
  type SceneId,
  type Snapshot,
  type SnapshotFileResult,
  type TimerCommand,
} from "../shared";
import { listPairedPixooDevices } from "./bluetooth/device-scanner";
import type { PixooBtClient } from "./bluetooth/pixoo-bt-client";
import type { GameStore } from "./domain/game-store";
import { generateId } from "./domain/ids";
import { SnapshotRepository } from "./domain/snapshot-repository";
import { profileForModel } from "./orchestration/device-profile";
import type { LiveController } from "./orchestration/live-controller";
import { Framebuffer } from "./render/framebuffer";
import { encodeFrame } from "./render/rgb-encoder";

export interface IpcBridgeDeps {
  store: GameStore;
  device: PixooBtClient;
  snapshots: SnapshotRepository;
}

/**
 * Wires renderer-side IPC calls to the GameStore + PixooBtClient, and
 * broadcasts state, preview frames, and BT status to every open
 * BrowserWindow.
 *
 * Lifecycle: construct → {@link attachWindow} once a window opens → call
 * {@link dispose} on app shutdown to unregister handlers and unsubscribe.
 */
export class IpcBridge {
  private readonly store: GameStore;
  private readonly device: PixooBtClient;
  private readonly snapshots: SnapshotRepository;
  private controller: LiveController | null = null;
  private readonly windows = new Set<BrowserWindow>();
  private latestDraftPreview: PreviewMessage | null = null;
  private latestLivePreview: PreviewMessage | null = null;
  private latestDraftState: import("../shared").GameState | null = null;
  private pendingCount = 0;
  private deviceUnsubscribe: (() => void) | null = null;

  constructor(deps: IpcBridgeDeps) {
    this.store = deps.store;
    this.device = deps.device;
    this.snapshots = deps.snapshots;
    this.registerHandlers();
    this.deviceUnsubscribe = this.device.onStatusChange((status) => this.pushBtStatus(status));
  }

  /** Wire the controller after construction so commit/discard handlers work. */
  attachController(controller: LiveController): void {
    this.controller = controller;
  }

  /** Register a renderer window to receive state + preview pushes. */
  attachWindow(window: BrowserWindow): void {
    this.windows.add(window);
    window.once("closed", () => this.windows.delete(window));
  }

  /** Called by LiveController for each draft state snapshot. */
  publishDraftState(state: import("../shared").GameState): void {
    this.latestDraftState = state;
    this.broadcast(IpcChannel.PushState, state);
  }

  /** Called by LiveController for each draft frame (mutation preview). */
  publishDraftFrame(frame: Framebuffer): void {
    const message = this.frameMessage(frame);
    this.latestDraftPreview = message;
    this.broadcast(IpcChannel.PushDraftPreview, message);
  }

  /** Called by LiveController for each live frame (on-device snapshot). */
  publishLiveFrame(frame: Framebuffer): void {
    const message = this.frameMessage(frame);
    this.latestLivePreview = message;
    this.broadcast(IpcChannel.PushLivePreview, message);
  }

  /** Called by LiveController whenever the queue depth changes. */
  publishPending(count: number): void {
    this.pendingCount = count;
    this.broadcast(IpcChannel.PushPending, { type: "pending", count });
  }

  private frameMessage(frame: Framebuffer): PreviewMessage {
    return {
      type: "preview",
      width: frame.width,
      height: frame.height,
      data: encodeFrame(frame),
    };
  }

  /** Tear down handlers and unsubscribe from store changes. */
  dispose(): void {
    this.deviceUnsubscribe?.();
    this.deviceUnsubscribe = null;
    for (const channel of Object.values(IpcChannel)) {
      ipcMain.removeHandler(channel);
    }
    this.windows.clear();
  }

  // ---------------------------------------------------------------- internals

  private registerHandlers(): void {
    ipcMain.handle(IpcChannel.Snapshot, (): Snapshot => this.snapshot());

    ipcMain.handle(IpcChannel.ScanDevices, () => listPairedPixooDevices());

    ipcMain.handle(IpcChannel.AddCombatant, (_event, input: AddCombatantInput) => {
      this.controller?.enqueue({
        kind: "add-combatant",
        combatantId: generateId(),
        group: input.group,
        name: input.name,
        maxHp: input.maxHp,
        charClass: input.charClass,
      });
    });

    ipcMain.handle(IpcChannel.AdjustHp, (_event, payload: { id: string; currentHp: number }) => {
      this.controller?.enqueue({
        kind: "adjust-hp",
        combatantId: payload.id,
        currentHp: payload.currentHp,
      });
    });

    ipcMain.handle(
      IpcChannel.SetCombatantClass,
      (_event, payload: { id: string; charClass: import("../shared").CombatantClass }) => {
        this.controller?.enqueue({
          kind: "update-combatant",
          combatantId: payload.id,
          charClass: payload.charClass,
        });
      },
    );

    ipcMain.handle(IpcChannel.RemoveCombatant, (_event, id: string) => {
      this.controller?.enqueue({ kind: "remove-combatant", combatantId: id });
    });

    ipcMain.handle(IpcChannel.SetScene, (_event, scene: SceneId) => {
      // Scene change clears any draft mutations staged for the previous scene
      // (they're for a different view) and queues a single new scene action.
      // User still has to commit to push it to the device.
      this.controller?.discard();
      this.controller?.enqueue({ kind: "set-scene", scene });
    });

    ipcMain.handle(IpcChannel.UpdateSettings, (_event, patch: DeviceSettingsPatch) => {
      this.store.updateDeviceSettings(patch);
    });

    ipcMain.handle(IpcChannel.Timer, (_event, command: TimerCommand) => {
      this.applyTimerCommand(command);
    });

    ipcMain.handle(IpcChannel.ListSnapshots, () => this.snapshots.list());

    ipcMain.handle(IpcChannel.SaveSnapshot, (_event, name: string) =>
      this.snapshots.save(name, this.persistedFromStore()),
    );

    ipcMain.handle(IpcChannel.LoadSnapshot, async (_event, id: string) => {
      const snap = await this.snapshots.load(id);
      if (!snap) return false;
      this.store.replaceState(SnapshotRepository.toPersistedState(snap.payload));
      return true;
    });

    ipcMain.handle(IpcChannel.DeleteSnapshot, (_event, id: string) => this.snapshots.delete(id));

    ipcMain.handle(
      IpcChannel.ExportSnapshot,
      (event, name: string): Promise<SnapshotFileResult> => this.handleExport(event, name),
    );

    ipcMain.handle(
      IpcChannel.ImportSnapshot,
      (event): Promise<SnapshotFileResult> => this.handleImport(event),
    );

    ipcMain.handle(IpcChannel.Commit, () => this.controller?.commit());
    ipcMain.handle(IpcChannel.Discard, () => this.controller?.discard());
    ipcMain.handle(IpcChannel.RunFrameBenchmark, () => this.runFrameBenchmark());
    ipcMain.handle(IpcChannel.ReconnectDevice, () => this.device.reconnect());
  }

  /**
   * Push a representative mix of test frames to the device and time each one.
   * Frames span several palette sizes so we can see how throughput scales with
   * payload size (palette bytes + bit-packed screen bytes).
   */
  private async runFrameBenchmark(): Promise<BenchmarkResult> {
    const profile = profileForModel(this.store.toState().device.model);
    const frames = buildBenchmarkFrames(profile.width, profile.height);
    // 30 KB/s byte budget + 10fps cap. 20 KB/s confirmed safe across all
    // palette sizes, so we can run the device a bit harder here.
    const { samples, error } = await this.device.benchmark(frames, {
      minIntervalMs: 100,
      bytesPerSec: 30_000,
    });
    const totalMs = samples.reduce((s, sample) => s + sample.ms, 0);
    const avgMs = samples.length > 0 ? totalMs / samples.length : 0;
    return {
      ok: error === null,
      error,
      samples,
      totalMs,
      avgMs,
      fps: avgMs > 0 ? 1000 / avgMs : 0,
    };
  }

  private async handleExport(
    event: Electron.IpcMainInvokeEvent,
    name: string,
  ): Promise<SnapshotFileResult> {
    const window = BrowserWindow.fromWebContents(event.sender);
    const safeName = name.replace(/[^\w\- ]+/g, "_").trim() || "dndmate-session";
    const result = window
      ? await dialog.showSaveDialog(window, {
          title: "Export DnDMate session",
          defaultPath: `${safeName}.dndmate.json`,
          filters: [{ name: "DnDMate session", extensions: ["json"] }],
        })
      : await dialog.showSaveDialog({
          defaultPath: `${safeName}.dndmate.json`,
          filters: [{ name: "DnDMate session", extensions: ["json"] }],
        });
    if (result.canceled || !result.filePath) {
      return { ok: false, snapshot: null, path: null, error: null };
    }
    try {
      await this.snapshots.exportToFile(result.filePath, name, this.persistedFromStore());
      return { ok: true, snapshot: null, path: result.filePath, error: null };
    } catch (error) {
      return {
        ok: false,
        snapshot: null,
        path: result.filePath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleImport(
    event: Electron.IpcMainInvokeEvent,
  ): Promise<SnapshotFileResult> {
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = window
      ? await dialog.showOpenDialog(window, {
          title: "Import DnDMate session",
          properties: ["openFile"],
          filters: [{ name: "DnDMate session", extensions: ["json"] }],
        })
      : await dialog.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "DnDMate session", extensions: ["json"] }],
        });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, snapshot: null, path: null, error: null };
    }
    const path = result.filePaths[0];
    try {
      const snap = await this.snapshots.importFromFile(path);
      if (!snap) {
        return {
          ok: false,
          snapshot: null,
          path,
          error: "Not a valid DnDMate session file.",
        };
      }
      // Importing creates a new in-app slot from the file's payload, so the
      // user gets a saved record (with a fresh id) they can reload later.
      const meta = await this.snapshots.save(
        snap.name,
        SnapshotRepository.toPersistedState(snap.payload),
      );
      return { ok: true, snapshot: meta, path, error: null };
    } catch (error) {
      return {
        ok: false,
        snapshot: null,
        path,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private persistedFromStore() {
    const state = this.store.toState();
    return {
      party: state.party,
      enemies: state.enemies,
      device: state.device,
      activeScene: state.activeScene,
    };
  }

  private applyTimerCommand(command: TimerCommand): void {
    switch (command.action) {
      case "start":
        this.store.startTimer(command.seconds);
        return;
      case "pause":
        this.store.pauseTimer();
        return;
      case "resume":
        this.store.resumeTimer();
        return;
      case "reset":
        this.store.resetTimer();
        return;
      case "add":
        this.store.addTimerSeconds(command.delta);
        return;
    }
  }

  private snapshot(): Snapshot {
    return {
      state: this.latestDraftState ?? this.controller?.getDraftState() ?? this.store.toState(),
      draftPreview: this.latestDraftPreview,
      livePreview: this.latestLivePreview,
      pendingCount: this.pendingCount,
      bt: this.device.currentStatus,
    };
  }

  private pushBtStatus(status: BtStatusMessage): void {
    this.broadcast(IpcChannel.PushBtStatus, status);
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const window of this.windows) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, payload);
      }
    }
  }
}

/**
 * Generate a deterministic mix of benchmark frames at varying palette sizes.
 *
 * Reps per palette size are sized so that each bucket pushes at least
 * SATURATION_BYTES of payload — small-palette frames fit into the kernel BT
 * socket buffer in microseconds, so without pushing enough bytes per bucket
 * the per-frame timing measures "how fast can we hand bytes to the kernel"
 * rather than the radio throughput we actually care about.
 */
function buildBenchmarkFrames(width: number, height: number): Framebuffer[] {
  const PALETTE_SIZES = [1, 4, 16, 64, 256, 1024];
  const MIN_REPS = 4;
  const MAX_REPS = 80;
  // Fewer total bytes per bucket: heavy frames already need long throttles
  // and we don't want to push the device near its session budget unnecessarily.
  const SATURATION_BYTES = 30_000;
  const frames: Framebuffer[] = [];
  for (const target of PALETTE_SIZES) {
    const sample = makeFrameWithNColors(width, height, target, 0);
    const approxBytes = estimatePayloadBytes(target, width * height);
    const reps = Math.max(
      MIN_REPS,
      Math.min(MAX_REPS, Math.ceil(SATURATION_BYTES / approxBytes)),
    );
    frames.push(sample);
    for (let rep = 1; rep < reps; rep++) {
      frames.push(makeFrameWithNColors(width, height, target, rep));
    }
  }
  return frames;
}

function estimatePayloadBytes(paletteCount: number, pixelCount: number): number {
  // Match the encoding in commands.ts: ceil(log2(N)) bits per pixel, 3 bytes
  // per palette entry, plus a fixed 19 bytes of header/envelope overhead.
  const bitsPerPixel = Math.max(1, Math.ceil(Math.log2(Math.max(1, paletteCount))));
  const screen = Math.ceil((bitsPerPixel * pixelCount) / 8);
  return paletteCount * 3 + screen + 19;
}

function makeFrameWithNColors(width: number, height: number, n: number, seed: number): Framebuffer {
  const fb = new Framebuffer(width, height);
  const total = width * height;
  const colors = Math.min(n, total);
  // Deterministic-ish palette: spread across the RGB cube using the seed.
  const palette: Array<{ r: number; g: number; b: number }> = [];
  for (let i = 0; i < colors; i++) {
    const hash = (i * 2654435761 + seed * 374761393) >>> 0;
    palette.push({ r: hash & 0xff, g: (hash >>> 8) & 0xff, b: (hash >>> 16) & 0xff });
  }
  for (let p = 0; p < total; p++) {
    const x = p % width;
    const y = Math.floor(p / width);
    fb.set(x, y, palette[p % palette.length]);
  }
  return fb;
}
