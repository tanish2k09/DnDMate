import { useEffect, useState } from "react";
import type {
  BenchmarkResult,
  BtStatusMessage,
  CombatantClass,
  DndmateApi,
  GameState,
  PreviewMessage,
  SavedSnapshotMetadata,
  ScannedDevice,
  SceneId,
  SnapshotFileResult,
  TimerCommand,
} from "../../shared";

export type ConnectionStatus = "connecting" | "open" | "closed";

const DISCONNECTED_BT: BtStatusMessage = {
  type: "bt-status",
  status: "disconnected",
  address: null,
  error: null,
};

export interface IpcConnection {
  status: ConnectionStatus;
  /** Latest draft preview — what the user is composing. */
  draftPreview: PreviewMessage | null;
  /** Latest live preview — what's on the device. */
  livePreview: PreviewMessage | null;
  /** Number of frames waiting for commit. */
  pendingCount: number;
  state: GameState | null;
  bt: BtStatusMessage;
}

/**
 * Subscribe to state, preview, and BT-status pushes from main, seeded by a
 * snapshot so the first render has data without waiting for a broadcast.
 *
 * If `window.dndmate` is missing (e.g., the preload script failed to load),
 * the hook stays in `connecting` indefinitely — main is the source of truth,
 * and there's no useful fallback.
 */
export function usePixooConnection(): IpcConnection {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [draftPreview, setDraftPreview] = useState<PreviewMessage | null>(null);
  const [livePreview, setLivePreview] = useState<PreviewMessage | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [state, setState] = useState<GameState | null>(null);
  const [bt, setBt] = useState<BtStatusMessage>(DISCONNECTED_BT);

  useEffect(() => {
    const api = window.dndmate;
    if (!api) return;

    let disposed = false;
    const unsubscribers: Array<() => void> = [];

    void api.snapshot().then((snapshot) => {
      if (disposed) return;
      setState(snapshot.state);
      setDraftPreview(snapshot.draftPreview);
      setLivePreview(snapshot.livePreview);
      setPendingCount(snapshot.pendingCount);
      setBt(snapshot.bt);
      setStatus("open");
    });

    unsubscribers.push(api.onState((next) => setState(next)));
    unsubscribers.push(api.onDraftPreview((next) => setDraftPreview(next)));
    unsubscribers.push(api.onLivePreview((next) => setLivePreview(next)));
    unsubscribers.push(api.onPending((count) => setPendingCount(count)));
    unsubscribers.push(api.onBtStatus((next) => setBt(next)));

    return () => {
      disposed = true;
      for (const off of unsubscribers) off();
      setStatus("closed");
    };
  }, []);

  return { status, draftPreview, livePreview, pendingCount, state, bt };
}

/** A typed client over the IPC action surface. Drop-in for the v1 restClient. */
export interface IpcClient {
  addCombatant(
    group: "party" | "enemy",
    name: string,
    maxHp: number,
    charClass: CombatantClass,
  ): Promise<void>;
  adjustHp(id: string, currentHp: number): Promise<void>;
  setCombatantClass(id: string, charClass: CombatantClass): Promise<void>;
  removeCombatant(id: string): Promise<void>;
  setScene(scene: SceneId): Promise<void>;
  updateSettings(patch: Parameters<DndmateApi["actions"]["updateSettings"]>[0]): Promise<void>;
  startTimer(seconds: number): Promise<void>;
  pauseTimer(): Promise<void>;
  resumeTimer(): Promise<void>;
  resetTimer(): Promise<void>;
  addTimerSeconds(delta: number): Promise<void>;
  scanDevices(): Promise<ScannedDevice[]>;
  listSnapshots(): Promise<SavedSnapshotMetadata[]>;
  saveSnapshot(name: string): Promise<SavedSnapshotMetadata>;
  loadSnapshot(id: string): Promise<boolean>;
  deleteSnapshot(id: string): Promise<void>;
  exportSnapshot(name: string): Promise<SnapshotFileResult>;
  importSnapshot(): Promise<SnapshotFileResult>;
  commit(): Promise<void>;
  discard(): Promise<void>;
  runFrameBenchmark(): Promise<BenchmarkResult>;
  reconnectDevice(): Promise<void>;
}

/** Adapt the preload API into the per-action shape the UI components expect. */
export function createIpcClient(api: DndmateApi): IpcClient {
  const timer = (command: TimerCommand) => api.actions.timer(command);
  return {
    addCombatant: (group, name, maxHp, charClass) =>
      api.actions.addCombatant({ group, name, maxHp, charClass }),
    adjustHp: (id, currentHp) => api.actions.adjustHp(id, currentHp),
    setCombatantClass: (id, charClass) => api.actions.setCombatantClass(id, charClass),
    removeCombatant: (id) => api.actions.removeCombatant(id),
    setScene: (scene) => api.actions.setScene(scene),
    updateSettings: (patch) => api.actions.updateSettings(patch),
    startTimer: (seconds) => timer({ action: "start", seconds }),
    pauseTimer: () => timer({ action: "pause" }),
    resumeTimer: () => timer({ action: "resume" }),
    resetTimer: () => timer({ action: "reset" }),
    addTimerSeconds: (delta) => timer({ action: "add", delta }),
    scanDevices: () => api.scanDevices(),
    listSnapshots: () => api.actions.listSnapshots(),
    saveSnapshot: (name) => api.actions.saveSnapshot(name),
    loadSnapshot: (id) => api.actions.loadSnapshot(id),
    deleteSnapshot: (id) => api.actions.deleteSnapshot(id),
    exportSnapshot: (name) => api.actions.exportSnapshot(name),
    importSnapshot: () => api.actions.importSnapshot(),
    commit: () => api.actions.commit(),
    discard: () => api.actions.discard(),
    runFrameBenchmark: () => api.actions.runFrameBenchmark(),
    reconnectDevice: () => api.actions.reconnectDevice(),
  };
}

/**
 * A no-op client used when the preload bridge is missing — keeps the UI
 * interactive (you can click) but every action is a noop. Logs once.
 */
function noopClient(): IpcClient {
  const warn = () => console.warn("dndmate IPC bridge unavailable — action ignored");
  return {
    addCombatant: async () => warn(),
    adjustHp: async () => warn(),
    setCombatantClass: async () => warn(),
    removeCombatant: async () => warn(),
    setScene: async () => warn(),
    updateSettings: async () => warn(),
    startTimer: async () => warn(),
    pauseTimer: async () => warn(),
    resumeTimer: async () => warn(),
    resetTimer: async () => warn(),
    addTimerSeconds: async () => warn(),
    scanDevices: async () => {
      warn();
      return [];
    },
    listSnapshots: async () => {
      warn();
      return [];
    },
    saveSnapshot: async (name: string) => {
      warn();
      return {
        id: "noop",
        name,
        savedAt: new Date().toISOString(),
        schemaVersion: 1,
        appVersion: "0.0.0",
      };
    },
    loadSnapshot: async () => {
      warn();
      return false;
    },
    deleteSnapshot: async () => warn(),
    exportSnapshot: async () => {
      warn();
      return { ok: false, snapshot: null, path: null, error: "IPC bridge unavailable" };
    },
    importSnapshot: async () => {
      warn();
      return { ok: false, snapshot: null, path: null, error: "IPC bridge unavailable" };
    },
    commit: async () => warn(),
    discard: async () => warn(),
    runFrameBenchmark: async () => {
      warn();
      return { ok: false, error: "IPC bridge unavailable", samples: [], totalMs: 0, avgMs: 0, fps: 0 };
    },
    reconnectDevice: async () => warn(),
  };
}

/** The singleton client; resolves the bridge once at module load. */
export const ipcClient: IpcClient = window.dndmate ? createIpcClient(window.dndmate) : noopClient();
