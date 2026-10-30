# Dependencies and availability

## Desktop development

Required: Go toolchain, Node.js/npm, and Chromium for genuine browser screenshots. The backend SQLite driver is pure Go (`modernc.org/sqlite`); no sqlite3 CLI or cgo is needed. `make run` runs gamed and the Vite frontend together.

Install frontend dependencies once with `cd apps/pocket-gamehub/frontend && npm install` (a `package-lock.json` is committed). The host's default DNS could not resolve `registry.npmjs.org` during development; npm was run through an SSH SOCKS proxy to a reachable machine (`ssh -D 127.0.0.1:1080 <host>`, then `ALL_PROXY=socks5h://127.0.0.1:1080 npm install`). This is an environment workaround, not a project requirement.

Port isolation matters on a shared workstation: several other dev servers already occupy 5173-5183, so GameHub uses `GAMEHUB_ADDR=127.0.0.1:18470` for gamed and `--port 18480` for the frontend. `vite.config.ts` reads `GAMEHUB_API_TARGET` (default `http://localhost:8080`) for its `/api` proxy, and applies it to both `server` and `preview`.

## Emulator

RetroArch is not installed in the current development environment, and `/run/current-system/sw/lib/libretro` is absent. No libretro cores or ROM files are available, and this machine has no display/X server. Therefore gameplay has not been tested and the UI must report RetroArch unavailable. The adapter is validated with a stub executable that records its arguments and exits with a selected code. A real installation requires RetroArch, a core compatible with the chosen platform, and legally obtained ROM files. Configure `RETROARCH` (optional binary path), `RETROARCH_CORE` (core path), `RETROARCH_CONFIG` (optional appended config), `GAMEHUB_ROMS` (ROM directory), then scan and launch on a machine with a display/session.

### Obtainable evidence attempt

`nix shell nixpkgs#retroarch -c retroarch --version` was attempted once. It
failed because the host's default DNS could not resolve `cache.nixos.org`, so no
RetroArch binary was ever produced or executed here. This is recorded as a failed
probe, not as evidence of a working emulator.

### What a real device needs

1. Install RetroArch and a core matching each platform (`mgba` for GB/GBC/GBA,
   `nestopia`/`snes9x` for NES/SNES, `beetle_psx`/`swanstation` for PS1,
   `melonds` for NDS, PPSSPP for PSP).
2. Point `RETROARCH` at the binary, `RETROARCH_CORE` at the core, optionally
   `RETROARCH_CONFIG` at an appended config.
3. Put ROMs under `ROMS/<PLATFORM>/`, set `GAMEHUB_ROMS`, then `POST /api/scan`.
4. Launch from the UI on a machine with a display/DRM session.

Only then does `/api/health` report `emulator: "available"` and `POST /api/launch`
start a real process.

## Browser tests

`make test-ui` needs Chromium and `puppeteer-core`. Defaults point at
`/run/current-system/sw/bin/chromium` and the local puppeteer-core install;
override with `CHROME_BIN=` and `PUPPETEER_CORE=`. The API integration suite
(`make test-integration`) needs only `curl` and `jq`.

## Metadata

Mock metadata is the default and supplies a 120-title catalogue. No ScreenScraper credentials are configured. Requests for scraping return `metadata_not_configured`; the current ScreenScraper adapter does not implement authenticated HTTP fetching, so providing credentials alone does not enable scraping. No real metadata fetch is claimed.
