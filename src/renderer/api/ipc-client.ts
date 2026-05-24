import { useEffect, useState } from "react";
import type { DndmateApi, GameState, PreviewMessage, SceneId, TimerCommand } from "../../shared";

export type ConnectionStatus = "connecting" | "open" | "closed";

export interface IpcConnection {
  status: ConnectionStatus;
  preview: PreviewMessage | null;
  state: GameState | null;
}

/**
 * Subscribe to state + preview pushes from main, seeded by a snapshot so the
 * first render has data without waiting for a mutation to broadcast.
 *
 * If `window.dndmate` is missing (e.g., the preload script failed to load),
 * the hook stays in `connecting` indefinitely — main is the source of truth,
 * and there's no useful fallback.
 */
export function usePixooConnection(): IpcConnection {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [preview, setPreview] = useState<PreviewMessage | null>(null);
  const [state, setState] = useState<GameState | null>(null);

  useEffect(() => {
    const api = window.dndmate;
    if (!api) return;

    let disposed = false;
    const unsubscribers: Array<() => void> = [];

    void api.snapshot().then((snapshot) => {
      if (disposed) return;
      setState(snapshot.state);
      setPreview(snapshot.preview);
      setStatus("open");
    });

    unsubscribers.push(api.onState((next) => setState(next)));
    unsubscribers.push(api.onPreview((next) => setPreview(next)));

    return () => {
      disposed = true;
      for (const off of unsubscribers) off();
      setStatus("closed");
    };
  }, []);

  return { status, preview, state };
}

/** A typed client over the IPC action surface. Drop-in for the v1 restClient. */
export interface IpcClient {
  addCombatant(group: "party" | "enemy", name: string, maxHp: number): Promise<void>;
  adjustHp(id: string, currentHp: number): Promise<void>;
  removeCombatant(id: string): Promise<void>;
  setScene(scene: SceneId): Promise<void>;
  updateSettings(patch: Parameters<DndmateApi["actions"]["updateSettings"]>[0]): Promise<void>;
  startTimer(seconds: number): Promise<void>;
  pauseTimer(): Promise<void>;
  resumeTimer(): Promise<void>;
  resetTimer(): Promise<void>;
  addTimerSeconds(delta: number): Promise<void>;
}

/** Adapt the preload API into the per-action shape the UI components expect. */
export function createIpcClient(api: DndmateApi): IpcClient {
  const timer = (command: TimerCommand) => api.actions.timer(command);
  return {
    addCombatant: (group, name, maxHp) => api.actions.addCombatant({ group, name, maxHp }),
    adjustHp: (id, currentHp) => api.actions.adjustHp(id, currentHp),
    removeCombatant: (id) => api.actions.removeCombatant(id),
    setScene: (scene) => api.actions.setScene(scene),
    updateSettings: (patch) => api.actions.updateSettings(patch),
    startTimer: (seconds) => timer({ action: "start", seconds }),
    pauseTimer: () => timer({ action: "pause" }),
    resumeTimer: () => timer({ action: "resume" }),
    resetTimer: () => timer({ action: "reset" }),
    addTimerSeconds: (delta) => timer({ action: "add", delta }),
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
    removeCombatant: async () => warn(),
    setScene: async () => warn(),
    updateSettings: async () => warn(),
    startTimer: async () => warn(),
    pauseTimer: async () => warn(),
    resumeTimer: async () => warn(),
    resetTimer: async () => warn(),
    addTimerSeconds: async () => warn(),
  };
}

/** The singleton client; resolves the bridge once at module load. */
export const ipcClient: IpcClient = window.dndmate ? createIpcClient(window.dndmate) : noopClient();
