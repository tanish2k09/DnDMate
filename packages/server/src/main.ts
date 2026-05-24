import { networkInterfaces } from "node:os";
import type { ServerMessage } from "@dndmate/shared";
import { startHttpServer } from "./api/http-server";
import { framebufferToPreview } from "./api/preview";
import { createRestRouter } from "./api/rest-routes";
import { WsHub } from "./api/ws-hub";
import { loadConfig } from "./config";
import { GameStore } from "./domain/game-store";
import { StateRepository } from "./domain/state-repository";
import { DeviceConnection } from "./orchestration/device-connection";
import { LiveController } from "./orchestration/live-controller";

/** Non-internal IPv4 addresses, so the user knows what URL to open on a phone. */
function lanAddresses(): string[] {
  const addresses: string[] = [];
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const iface of interfaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const config = loadConfig();
const repository = new StateRepository();
const store = new GameStore(await repository.load(), repository);
const hub = new WsHub();
const deviceConnection = new DeviceConnection();
let latestPreview: ServerMessage | null = null;

// The live controller renders the active scene and feeds both the device and
// the browser preview whenever the game state changes.
const controller = new LiveController({
  store,
  device: deviceConnection,
  onFrame: (frame) => {
    const preview = framebufferToPreview(frame);
    latestPreview = preview;
    hub.broadcast(preview);
  },
});

const server = startHttpServer({
  config,
  hub,
  restHandler: createRestRouter(store),
  currentPreview: () => latestPreview,
  currentState: () => store.toState(),
});

// Broadcast the full game state to every client whenever it changes.
store.onChange(() => {
  hub.broadcast({ type: "state", state: store.toState() });
});

controller.start();

// Persist any pending changes on shutdown.
process.on("SIGINT", () => {
  store.flush().finally(() => process.exit(0));
});

console.log(`DnDMate server listening on port ${server.port}`);
console.log(`  Local:   http://localhost:${server.port}`);
for (const address of lanAddresses()) {
  console.log(`  Network: http://${address}:${server.port}   <- open this on a phone`);
}
