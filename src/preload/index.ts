import { contextBridge, ipcRenderer } from "electron";
import {
  type AddCombatantInput,
  type DeviceSettingsPatch,
  type DndmateApi,
  type GameState,
  IpcChannel,
  type PreviewMessage,
  type SceneId,
  type Snapshot,
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
  onPreview: (listener) => subscribe<PreviewMessage>(IpcChannel.PushPreview, listener),
  actions: {
    addCombatant: (input: AddCombatantInput) =>
      ipcRenderer.invoke(IpcChannel.AddCombatant, input) as Promise<void>,
    adjustHp: (id: string, currentHp: number) =>
      ipcRenderer.invoke(IpcChannel.AdjustHp, { id, currentHp }) as Promise<void>,
    removeCombatant: (id: string) =>
      ipcRenderer.invoke(IpcChannel.RemoveCombatant, id) as Promise<void>,
    setScene: (scene: SceneId) => ipcRenderer.invoke(IpcChannel.SetScene, scene) as Promise<void>,
    updateSettings: (patch: DeviceSettingsPatch) =>
      ipcRenderer.invoke(IpcChannel.UpdateSettings, patch) as Promise<void>,
    timer: (command: TimerCommand) =>
      ipcRenderer.invoke(IpcChannel.Timer, command) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld("dndmate", api);

declare global {
  interface Window {
    dndmate: DndmateApi;
  }
}
