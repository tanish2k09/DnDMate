import { APP_NAME, APP_VERSION, type DeviceSettings, isSceneId } from "@dndmate/shared";
import type { GameStore } from "../domain/game-store";

/** Handles an `/api/*` request, or returns null if the path is not an API route. */
export type RestHandler = (req: Request, url: URL) => Promise<Response | null>;

/** Build the REST router. Every mutation flows through the {@link GameStore}. */
export function createRestRouter(store: GameStore): RestHandler {
  return async (req, url) => {
    const { pathname } = url;
    if (!pathname.startsWith("/api/")) {
      return null;
    }
    const { method } = req;

    if (pathname === "/api/health" && method === "GET") {
      return Response.json({ ok: true, app: APP_NAME, version: APP_VERSION });
    }

    if (pathname === "/api/state" && method === "GET") {
      return Response.json(store.toState());
    }

    if (pathname === "/api/combatants" && method === "POST") {
      const body = await readBody(req);
      const group = body?.group;
      const name = body?.name;
      const maxHp = body?.maxHp;
      if ((group !== "party" && group !== "enemy") || typeof name !== "string") {
        return badRequest("expected { group: 'party' | 'enemy', name: string, maxHp: number }");
      }
      const combatant = store.addCombatant(group, name, typeof maxHp === "number" ? maxHp : 10);
      return Response.json(combatant, { status: 201 });
    }

    const combatantId = matchPath(pathname, /^\/api\/combatants\/([^/]+)$/);
    if (combatantId) {
      if (method === "PATCH") {
        const body = await readBody(req);
        if (!body) return badRequest("expected a JSON body");
        const updated = store.updateCombatant(combatantId, {
          name: typeof body.name === "string" ? body.name : undefined,
          currentHp: typeof body.currentHp === "number" ? body.currentHp : undefined,
          maxHp: typeof body.maxHp === "number" ? body.maxHp : undefined,
        });
        return updated ? Response.json(updated) : notFound();
      }
      if (method === "DELETE") {
        return store.removeCombatant(combatantId) ? Response.json({ ok: true }) : notFound();
      }
    }

    if (pathname === "/api/settings" && method === "PATCH") {
      const body = await readBody(req);
      if (!body) return badRequest("expected a JSON body");
      const patch: Partial<DeviceSettings> = {};
      if (body.host === null || typeof body.host === "string") patch.host = body.host;
      if (typeof body.brightness === "number") patch.brightness = body.brightness;
      if (body.model === "pixoo-max" || body.model === "pixoo-64") patch.model = body.model;
      store.updateDeviceSettings(patch);
      return Response.json(store.toState().device);
    }

    if (pathname === "/api/scene" && method === "POST") {
      const body = await readBody(req);
      const scene = body?.scene;
      if (!isSceneId(scene)) {
        return badRequest("expected { scene: SceneId }");
      }
      store.setActiveScene(scene);
      return Response.json({ activeScene: scene });
    }

    if (pathname === "/api/timer" && method === "POST") {
      const body = await readBody(req);
      switch (body?.action) {
        case "start":
          store.startTimer(typeof body.seconds === "number" ? body.seconds : 60);
          break;
        case "pause":
          store.pauseTimer();
          break;
        case "resume":
          store.resumeTimer();
          break;
        case "reset":
          store.resetTimer();
          break;
        case "add":
          store.addTimerSeconds(typeof body.delta === "number" ? body.delta : 0);
          break;
        default:
          return badRequest("expected { action: 'start'|'pause'|'resume'|'reset'|'add' }");
      }
      return Response.json(store.toState().timer);
    }

    return notFound();
  };
}

/** Parse a request body as a JSON object, or return null if it is not one. */
async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await req.json();
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Return the first capture group if `pathname` matches `pattern`, else null. */
function matchPath(pathname: string, pattern: RegExp): string | null {
  const match = pathname.match(pattern);
  return match ? match[1] : null;
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function notFound(): Response {
  return Response.json({ error: "not found" }, { status: 404 });
}
