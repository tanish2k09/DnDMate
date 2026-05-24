import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const root = dirname(fileURLToPath(import.meta.url));

// Note: shared types live at src/shared/. We import them with relative paths
// from main/preload/renderer because electron-vite's SSR resolver doesn't
// honor `resolve.alias` for bare specifiers in the main/preload bundles. The
// `@shared` alias still exists in tsconfig + vitest for testing convenience.

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: resolve(root, "src/renderer"),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(root, "src/renderer/index.html"),
      },
    },
  },
});
