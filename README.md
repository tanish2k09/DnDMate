# DnDMate

An Electron desktop app for D&D Dungeon Masters that drives live visuals on a
**Divoom Pixoo Max** (32×32 pixel LED display) over Bluetooth — an hourglass
countdown timer, party HP bars, and enemy HP bars — during tabletop sessions.

## Architecture

DnDMate is a single Electron app:

- **`src/main/`** — Node main process. Owns the BT connection, the rendering
  engine, the game state, and the live orchestration loop. Talks to the
  renderer over IPC.
- **`src/preload/`** — context-isolated bridge exposing a typed
  `window.dndmate` API to the renderer.
- **`src/renderer/`** — the React UI (roster, scene picker, timer, device
  setup, live preview canvas).
- **`src/shared/`** — TypeScript types shared by main / preload / renderer.

The Pixoo Max is **Bluetooth-only** (no WiFi, no HTTP API on the 32×32 model).
The app speaks BT Classic RFCOMM via `node-bluetooth-serial-port`; pairing
itself happens once in **System Settings → Bluetooth** on macOS.

## Requirements

- **macOS 11 (Big Sur) or later** for real-device use. The app runs on
  Windows/Linux for UI development but won't reach the Pixoo there (no RFCOMM
  support in the native module on Windows; the app falls back to a mock
  transport that still drives the on-screen preview).
- **Node 20.11+** (Node 22 recommended — Electron 33 bundles it).
- **Xcode Command Line Tools** on macOS — needed by `node-gyp` to rebuild the
  BT native module against Electron's ABI:

  ```sh
  xcode-select --install
  ```

## Getting started

```sh
npm install        # runs electron-builder install-app-deps automatically
npm run dev        # open the app
```

On first launch the app asks for Bluetooth permission (macOS prompt). Grant
it, then in the Setup panel click **Scan paired devices** — anything you've
already paired in System Settings shows up. Click the Pixoo entry to bind it.

To develop the UI without a Pixoo (or on Windows):

```sh
npm run dev:mock   # forces the mock transport even on macOS
```

## Pairing the Pixoo Max

1. Power on the Pixoo Max.
2. Open **System Settings → Bluetooth** on your Mac.
3. Wait for `Pixoo-Max` (or similar) to appear. Click **Connect**.
4. In DnDMate, open the **Setup** panel and **Scan paired devices**.
5. Click the Pixoo entry. The status badge in the header should switch from
   `Connecting…` to `Connected AA:BB:CC:DD:EE:FF`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the Electron app with hot reload |
| `npm run dev:mock` | Same, but force the mock BT transport |
| `npm run build` | Build main + preload + renderer bundles |
| `npm run package` | Build + bundle a macOS `.dmg` via electron-builder |
| `npm test` | Run the Vitest suite |
| `npm run typecheck` | `tsc --noEmit` across the whole tree |
| `npm run lint` / `format` | Biome |

## Packaging a `.dmg`

```sh
npm run package
```

Produces `release/DnDMate-<version>-<arch>.dmg`. The build is **unsigned** —
on first open macOS Gatekeeper will refuse to launch it. Right-click → Open
once to teach Gatekeeper to trust it.

If you want a signed/notarised build, set `identity` in
`package.json#build.mac` and configure Apple Developer credentials via
electron-builder's standard env vars (`CSC_LINK`, `CSC_KEY_PASSWORD`,
`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).

## Troubleshooting

**`Error: Module did not self-register` on launch** — the native BT module
was built against the wrong Node ABI. Re-run `npm install` to trigger
`electron-builder install-app-deps`, or manually:

```sh
npx electron-rebuild -f -w node-bluetooth-serial-port
```

**Status badge stuck at `Connecting…`** — the address is reachable but the
SDP channel lookup is timing out. The app falls back to channel 1 (the
documented Pixoo channel) after 3s; if connection still fails, double-check
the Pixoo is paired in System Settings (not just powered on).

**`BT unavailable`** — the native module didn't load. Check that you're on
macOS (Windows has no RFCOMM path here) and that `xcode-select --install`
has been run.

## Status

Phase 2 milestones M-1 through M7 are complete (see plan in `docs/`). The
M4+ hardware path (real Pixoo Max + real RFCOMM bytes) is unverified in
this repo — the first real-device run is the next thing to confirm.
