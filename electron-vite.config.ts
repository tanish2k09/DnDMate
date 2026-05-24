import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const root = dirname(fileURLToPath(import.meta.url));
const sharedAlias = { "@shared": resolve(root, "src/shared") };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
  },
  renderer: {
    root: resolve(root, "src/renderer"),
    resolve: { alias: sharedAlias },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(root, "src/renderer/index.html"),
      },
    },
  },
});
