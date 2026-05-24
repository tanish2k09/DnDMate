import { type BrowserWindow, ipcMain } from "electron";
import {
  type AddCombatantInput,
  type BtStatusMessage,
  type DeviceSettingsPatch,
  IpcChannel,
  type PreviewMessage,
  type SceneId,
  type Snapshot,
  type TimerCommand,
} from "../shared";
import { listPairedPixooDevices } from "./bluetooth/device-scanner";
import type { PixooBtClient } from "./bluetooth/pixoo-bt-client";
import type { GameStore } from "./domain/game-store";
import type { Framebuffer } from "./render/framebuffer";
import { encodeFrame } from "./render/rgb-encoder";

export interface IpcBridgeDeps {
  store: GameStore;
  device: PixooBtClient;
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
  private readonly windows = new Set<BrowserWindow>();
  private latestPreview: PreviewMessage | null = null;
  private storeUnsubscribe: (() => void) | null = null;
  private deviceUnsubscribe: (() => void) | null = null;

  constructor(deps: IpcBridgeDeps) {
    this.store = deps.store;
    this.device = deps.device;
    this.registerHandlers();
    this.storeUnsubscribe = this.store.onChange(() => this.pushState());
    this.deviceUnsubscribe = this.device.onStatusChange((status) => this.pushBtStatus(status));
  }

  /** Register a renderer window to receive state + preview pushes. */
  attachWindow(window: BrowserWindow): void {
    this.windows.add(window);
    window.once("closed", () => this.windows.delete(window));
  }

  /** Called by LiveController for every rendered frame. */
  publishFrame(frame: Framebuffer): void {
    const message: PreviewMessage = {
      type: "preview",
      width: frame.width,
      height: frame.height,
      data: encodeFrame(frame),
    };
    this.latestPreview = message;
    this.broadcast(IpcChannel.PushPreview, message);
  }

  /** Tear down handlers and unsubscribe from store changes. */
  dispose(): void {
    this.storeUnsubscribe?.();
    this.storeUnsubscribe = null;
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
      this.store.addCombatant(input.group, input.name, input.maxHp);
    });

    ipcMain.handle(IpcChannel.AdjustHp, (_event, payload: { id: string; currentHp: number }) => {
      this.store.updateCombatant(payload.id, { currentHp: payload.currentHp });
    });

    ipcMain.handle(IpcChannel.RemoveCombatant, (_event, id: string) => {
      this.store.removeCombatant(id);
    });

    ipcMain.handle(IpcChannel.SetScene, (_event, scene: SceneId) => {
      this.store.setActiveScene(scene);
    });

    ipcMain.handle(IpcChannel.UpdateSettings, (_event, patch: DeviceSettingsPatch) => {
      this.store.updateDeviceSettings(patch);
    });

    ipcMain.handle(IpcChannel.Timer, (_event, command: TimerCommand) => {
      this.applyTimerCommand(command);
    });
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
      state: this.store.toState(),
      preview: this.latestPreview,
      bt: this.device.currentStatus,
    };
  }

  private pushState(): void {
    this.broadcast(IpcChannel.PushState, this.store.toState());
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
