# Dependencies and availability

## Desktop development

Required: Go toolchain, Node.js/npm, and Chromium for genuine browser screenshots. The backend SQLite driver is pure Go (`modernc.org/sqlite`); no sqlite3 CLI or cgo is needed. `make run` runs gamed and the Vite frontend together.

Install frontend dependencies once with `cd apps/pocket-gamehub/frontend && npm install` (a `package-lock.json` is committed). The host's default DNS could not resolve `registry.npmjs.org` during development; npm was run through an SSH SOCKS proxy to a reachable machine (`ssh -D 127.0.0.1:1080 <host>`, then `ALL_PROXY=socks5h://127.0.0.1:1080 npm install`). This is an environment workaround, not a project requirement.

Port isolation matters on a shared workstation: several other dev servers already occupy 5173-5183, so GameHub uses `GAMEHUB_ADDR=127.0.0.1:18470` for gamed and `--port 18480` for the frontend. `vite.config.ts` reads `GAMEHUB_API_TARGET` (default `http://localhost:8080`) for its `/api` proxy, and applies it to both `server` and `preview`.

## Emulator

RetroArch is not installed in the current development environment, and `/run/current-system/sw/lib/libretro` is absent. No libretro cores or ROM files are available, and this machine has no display/X server. Therefore gameplay has not been tested and the UI must report RetroArch unavailable. The adapter is validated with a stub executable that records its arguments and exits with a selected code. A real installation requires RetroArch, a core compatible with the chosen platform, and legally obtained ROM files. Configure `RETROARCH` (optional binary path), `RETROARCH_CORE` (core path), `RETROARCH_CONFIG` (optional appended config), `GAMEHUB_ROMS` (ROM directory), then scan and launch on a machine with a display/session.

A one-off `nix shell nixpkgs#retroarch -c retroarch --version` was permitted as evidence but was not needed to implement the stub contract; no successful real RetroArch probe is claimed here.

## Metadata

Mock metadata is the default and supplies a 120-title catalogue. No ScreenScraper credentials are configured. Requests for scraping return `metadata_not_configured`; the current ScreenScraper adapter does not implement authenticated HTTP fetching, so providing credentials alone does not enable scraping. No real metadata fetch is claimed.
