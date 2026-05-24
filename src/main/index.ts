import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";
import { GameStore } from "./domain/game-store";
import { StateRepository } from "./domain/state-repository";
import { IpcBridge } from "./ipc-bridge";
import { NullDeviceConnection } from "./orchestration/device-connection";
import { LiveController } from "./orchestration/live-controller";

const here = dirname(fileURLToPath(import.meta.url));

interface AppContext {
  store: GameStore;
  controller: LiveController;
  bridge: IpcBridge;
}

async function bootstrap(): Promise<AppContext> {
  const repository = new StateRepository(join(app.getPath("userData"), "dndmate.json"));
  const initial = await repository.load();
  const store = new GameStore(initial, repository);

  // Build the bridge first so the controller's first render lands in the
  // preview buffer even before any window attaches.
  const bridge = new IpcBridge({ store });

  const controller = new LiveController({
    store,
    device: new NullDeviceConnection(),
    onFrame: (frame) => bridge.publishFrame(frame),
  });
  controller.start();

  return { store, controller, bridge };
}

function createWindow(bridge: IpcBridge): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 540,
    title: "DnDMate",
    backgroundColor: "#0c0c10",
    webPreferences: {
      preload: join(here, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  bridge.attachWindow(window);

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(join(here, "../renderer/index.html"));
  }

  if (!app.isPackaged) {
    window.webContents.openDevTools({ mode: "detach" });
  }

  return window;
}

app.whenReady().then(async () => {
  const ctx = await bootstrap();
  createWindow(ctx.bridge);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(ctx.bridge);
  });

  app.on("before-quit", async () => {
    ctx.controller.stop();
    ctx.bridge.dispose();
    await ctx.store.flush();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
