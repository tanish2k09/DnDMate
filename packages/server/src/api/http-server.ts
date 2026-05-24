import { existsSync } from "node:fs";
import { join } from "node:path";
import { APP_NAME, type GameState, type ServerMessage } from "@dndmate/shared";
import type { ServerConfig } from "../config";
import type { RestHandler } from "./rest-routes";
import type { WsHub } from "./ws-hub";

/** Absolute path to the built web UI (`packages/web/dist`). */
const webDist = join(import.meta.dir, "../../../web/dist");

export interface HttpServerDeps {
  readonly config: ServerConfig;
  readonly hub: WsHub;
  /** Handles `/api/*` routes; returns null for non-API paths. */
  readonly restHandler: RestHandler;
  /** Latest preview, replayed to a client immediately after it connects. */
  readonly currentPreview: () => ServerMessage | null;
  /** Current game state, sent to a client immediately after it connects. */
  readonly currentState: () => GameState;
}

/**
 * Start the HTTP + WebSocket server.
 *
 * Routes: a WebSocket upgrade at `/ws`, the REST API under `/api/*`, and the
 * built web UI (with an SPA fallback) for everything else.
 */
export function startHttpServer(deps: HttpServerDeps) {
  const { config, hub, restHandler, currentPreview, currentState } = deps;

  return Bun.serve({
    port: config.port,
    hostname: config.host,
    async fetch(req, server): Promise<Response | undefined> {
      const url = new URL(req.url);

      if (url.pathname === "/ws") {
        return server.upgrade(req)
          ? undefined
          : new Response("WebSocket upgrade failed", { status: 426 });
      }

      const apiResponse = await restHandler(req, url);
      if (apiResponse) {
        return apiResponse;
      }

      return serveWebUi(url.pathname);
    },
    websocket: {
      open(ws) {
        hub.add(ws);
        const preview = currentPreview();
        if (preview) {
          hub.send(ws, preview);
        }
        hub.send(ws, { type: "state", state: currentState() });
      },
      close(ws) {
        hub.remove(ws);
      },
      message() {
        // Browsers are receive-only until the intent protocol lands in M6.
      },
    },
  });
}

/** Serve a file from the built web UI, falling back to `index.html` for client-side routes. */
async function serveWebUi(pathname: string): Promise<Response> {
  if (!existsSync(webDist)) {
    return new Response(
      `${APP_NAME} server is running.\n\nThe web UI has not been built yet — run "bun run build".`,
      { headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(webDist, requested);

  // Guard against path traversal: the resolved path must stay inside webDist.
  if (filePath.startsWith(webDist)) {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }
  }

  // SPA fallback — let the client router handle unknown paths.
  return new Response(Bun.file(join(webDist, "index.html")));
}
