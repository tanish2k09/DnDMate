import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("dndmate", {
  version: "0.2.0",
});

declare global {
  interface Window {
    dndmate: {
      version: string;
    };
  }
}
