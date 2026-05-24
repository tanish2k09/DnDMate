/**
 * `@dndmate/shared` — types and constants shared by the server and the web UI.
 *
 * This package is consumed as raw TypeScript source: the server runs it directly
 * via Bun, and Vite transpiles it for the browser. Keep it free of runtime
 * dependencies and platform-specific APIs.
 */

export * from "./domain";
export * from "./protocol";

export const APP_NAME = "DnDMate";
export const APP_VERSION = "0.1.0";

/** Response shape for `GET /api/health`. */
export interface HealthResponse {
  ok: boolean;
  app: string;
  version: string;
}
