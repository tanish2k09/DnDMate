import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";

const here = dirname(fileURLToPath(import.meta.url));

function createWindow(): void {
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

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(join(here, "../renderer/index.html"));
  }

  if (!app.isPackaged) {
    window.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
