import { contextBridge, ipcRenderer } from "electron";
import {
  type AddCombatantInput,
  type BenchmarkResult,
  type BtStatusMessage,
  type DeviceSettingsPatch,
  type DndmateApi,
  type GameState,
  IpcChannel,
  type PreviewMessage,
  type SavedSnapshotMetadata,
  type ScannedDevice,
  type SceneId,
  type Snapshot,
  type SnapshotFileResult,
  type TimerCommand,
} from "../shared";

/**
 * The preload script runs in a sandboxed bridge context with access to both
 * Node and the DOM. It exposes a single, typed API surface to the renderer via
 * `contextBridge` so the rest of the app can stay sandbox-isolated.
 */

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_: unknown, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.off(channel, handler);
}

const api: DndmateApi = {
  version: "0.2.0",
  snapshot: () => ipcRenderer.invoke(IpcChannel.Snapshot) as Promise<Snapshot>,
  onState: (listener) => subscribe<GameState>(IpcChannel.PushState, listener),
  onDraftPreview: (listener) => subscribe<PreviewMessage>(IpcChannel.PushDraftPreview, listener),
  onLivePreview: (listener) => subscribe<PreviewMessage>(IpcChannel.PushLivePreview, listener),
  onPending: (listener) =>
    subscribe<{ type: "pending"; count: number }>(IpcChannel.PushPending, (msg) =>
      listener(msg.count),
    ),
  onBtStatus: (listener) => subscribe<BtStatusMessage>(IpcChannel.PushBtStatus, listener),
  scanDevices: () => ipcRenderer.invoke(IpcChannel.ScanDevices) as Promise<ScannedDevice[]>,
  actions: {
    addCombatant: (input: AddCombatantInput) =>
      ipcRenderer.invoke(IpcChannel.AddCombatant, input) as Promise<void>,
    adjustHp: (id: string, currentHp: number) =>
      ipcRenderer.invoke(IpcChannel.AdjustHp, { id, currentHp }) as Promise<void>,
    setCombatantClass: (id, charClass) =>
      ipcRenderer.invoke(IpcChannel.SetCombatantClass, { id, charClass }) as Promise<void>,
    removeCombatant: (id: string) =>
      ipcRenderer.invoke(IpcChannel.RemoveCombatant, id) as Promise<void>,
    setScene: (scene: SceneId) => ipcRenderer.invoke(IpcChannel.SetScene, scene) as Promise<void>,
    updateSettings: (patch: DeviceSettingsPatch) =>
      ipcRenderer.invoke(IpcChannel.UpdateSettings, patch) as Promise<void>,
    timer: (command: TimerCommand) =>
      ipcRenderer.invoke(IpcChannel.Timer, command) as Promise<void>,
    listSnapshots: () =>
      ipcRenderer.invoke(IpcChannel.ListSnapshots) as Promise<SavedSnapshotMetadata[]>,
    saveSnapshot: (name: string) =>
      ipcRenderer.invoke(IpcChannel.SaveSnapshot, name) as Promise<SavedSnapshotMetadata>,
    loadSnapshot: (id: string) =>
      ipcRenderer.invoke(IpcChannel.LoadSnapshot, id) as Promise<boolean>,
    deleteSnapshot: (id: string) =>
      ipcRenderer.invoke(IpcChannel.DeleteSnapshot, id) as Promise<void>,
    exportSnapshot: (name: string) =>
      ipcRenderer.invoke(IpcChannel.ExportSnapshot, name) as Promise<SnapshotFileResult>,
    importSnapshot: () =>
      ipcRenderer.invoke(IpcChannel.ImportSnapshot) as Promise<SnapshotFileResult>,
    commit: () => ipcRenderer.invoke(IpcChannel.Commit) as Promise<void>,
    discard: () => ipcRenderer.invoke(IpcChannel.Discard) as Promise<void>,
    runFrameBenchmark: () =>
      ipcRenderer.invoke(IpcChannel.RunFrameBenchmark) as Promise<BenchmarkResult>,
    reconnectDevice: () => ipcRenderer.invoke(IpcChannel.ReconnectDevice) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld("dndmate", api);

declare global {
  interface Window {
    dndmate: DndmateApi;
  }
}
