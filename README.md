# DnDMate

A controller for a **Divoom Pixoo Max** (32×32 pixel LED display) that pushes live
visuals during tabletop Dungeons & Dragons sessions — an hourglass countdown timer
and HP bars for the party and enemies.

## Architecture

DnDMate is a small **local server + browser UI**:

- **`packages/server`** — the "brain". Owns the device connection, the rendering
  engine, game state, and the live orchestration loop. Serves the web UI and a
  REST + WebSocket API.
- **`packages/web`** — a React UI that runs in any browser (iPhone, MacBook, …).
  It sends intents and receives live state + a preview framebuffer over WebSocket.
- **`packages/shared`** — TypeScript types shared by both.

The browser only ever talks to the local server (same-origin), which sidesteps the
browser CORS / mixed-content restrictions that block a web app from talking to the
device's plain-HTTP LAN API directly. No Xcode, App Store, or Apple Developer
account is required — it runs wherever there is a browser.

See `docs/` / the plan file for the full architecture rationale.

## Requirements

- [Bun](https://bun.sh) 1.3+

## Getting started

```sh
bun install

# Development (two processes):
bun run dev:server   # API + WebSocket on http://localhost:4321
bun run dev:web      # Vite dev server with hot reload on http://localhost:5173

# Production-style (server serves the built UI):
bun run build        # builds the web UI into packages/web/dist
bun run start        # serve everything from the server on port 4321
```

Open the printed `Network:` URL on a phone on the same Wi-Fi to use it there.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev:server` | Run the server with hot reload |
| `bun run dev:web` | Run the Vite dev server |
| `bun run build` | Build the web UI |
| `bun run start` | Run the server (serves the built UI) |
| `bun run typecheck` | Type-check every package |
| `bun run test` | Run the test suite |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format with Biome |
