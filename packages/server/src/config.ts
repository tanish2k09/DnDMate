/** Runtime configuration for the DnDMate server. */
export interface ServerConfig {
  /** TCP port the HTTP + WebSocket server binds to. */
  port: number;
  /** Interface to bind. `0.0.0.0` exposes the server to the LAN (needed for phones). */
  host: string;
}

const DEFAULT_PORT = 4321;
const DEFAULT_HOST = "0.0.0.0";

/** Build the server config from environment variables, falling back to defaults. */
export function loadConfig(): ServerConfig {
  const portEnv = process.env.DNDMATE_PORT;
  const parsedPort = portEnv ? Number.parseInt(portEnv, 10) : DEFAULT_PORT;

  return {
    port: Number.isFinite(parsedPort) ? parsedPort : DEFAULT_PORT,
    host: process.env.DNDMATE_HOST ?? DEFAULT_HOST,
  };
}
