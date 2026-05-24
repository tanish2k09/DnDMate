import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * In development the Vite dev server (port 5173) proxies `/api` and `/ws` to the
 * DnDMate server (port 4321), so the browser only ever sees a single origin —
 * the same arrangement that holds in production, where the server serves the
 * built UI directly.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:4321",
      "/ws": { target: "ws://localhost:4321", ws: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
