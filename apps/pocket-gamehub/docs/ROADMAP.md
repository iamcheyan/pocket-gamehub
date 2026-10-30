# Roadmap and limitations

## Implemented

**Service (`gamed`)**
- Versioned SQLite migrations (`schema_migrations`) applied on startup; tables
  `games`, `platforms`, `collections`, `collection_games`, `favorites`,
  `history`, `screenshots`, `settings`.
- 120-entry mock catalogue seeded with recognisable placeholder titles.
- ROM discovery: extension + directory platform inference, CUE/BIN grouping,
  mtime/size incremental updates, cancellation, progress reporting, and pruning
  of catalogue rows whose ROM disappeared (bounded to the scan root).
- Emulator abstraction: `RetroArchAdapter` (real CLI contract
  `-L <core> <rom> --appendconfig=<cfg>`), `PPSSPPAdapter`, generic
  `StandaloneAdapter`. Process exit is watched and written to history.
- Metadata: `MockMetadataProvider` (default) and `ScreenScraperProvider` which
  reports `metadata_not_configured` instead of pretending to scrape.
- REST API covering health, home, games, platforms, favorites, collections
  (CRUD + membership), search, launch/stop, history, covers, screenshots,
  scan, metadata, settings.

**Frontend**
- React + Vite + TypeScript; `GameAPI` / `StorageAPI` / `MediaAPI` /
  `SystemAPI` interfaces with HTTP defaults, so PocketJS Runtime bindings can
  replace them without touching views.
- Home, Library (all / platform / category / collection), Game Detail, Search,
  Collections, Settings.
- Handheld-first layout, verified at 320×240, 480×320, 640×480, 720×720,
  1280×720 and 1920×1080, plus DPR 1×/1.5×/2×/3× captures.
- Keyboard and gamepad navigation (D-Pad, ABXY, START, SELECT, MENU,
  L1/R1, L2/R2) with an in-app mapping panel.
- English / 简体中文 / 日本語 (76 keys, key-set parity checked), and
  Light / Dark / System themes.

**Verification**
- `make test` = Go vet + Go tests, i18n key parity, `tsc --noEmit`,
  production build, and a 69-assertion API integration suite.
- `make test-ui` drives the real app in Chromium to prove the 320×240 flow
  (browse → detail → favourite → launch).
- 58 genuine screenshots (9 views × 6 resolutions + 4 DPI captures), each a
  unique image, with PNG header dimensions checked against filenames.

## Known limitations

- **No real gameplay here.** RetroArch, libretro cores, ROMs and a display
  server are absent on the development machine. Only the stub-executable path is
  verified: it asserts the exact argv, waits for exit, and records exit code,
  timestamps and playtime. Real emulator boot is not claimed.
- **ScreenScraper is not functional.** No credentials are configured and the
  authenticated HTTP client is not implemented; scrape requests return
  `metadata_not_configured`.
- **Save/load state is unsupported** in the process-only adapter. It would need
  a RetroArch command channel; no save format is reimplemented.
- **Live screenshot capture** from a running emulator is not implemented; the
  `/api/screenshots` route returns stored records only.
- **320×240 space is tight**: the fixed bottom navigation occupies 49px, so the
  first row of cards is visible but longer lists need scrolling.
- **Ports are configurable, not fixed**: `make run` uses 18470/18480 because
  other projects on this workstation occupy 5173–5183.

## PJOS migration

1. Keep `gamed` as the only data/emulator entry point; the UI must not gain
   filesystem or process access.
2. Swap the HTTP implementations behind `GameAPI` / `StorageAPI` / `MediaAPI` /
   `SystemAPI` for PocketJS Runtime bindings, preserving the TypeScript
   contracts and error codes.
3. Package frontend and service per the `.pj` / Pocket Runtime lifecycle, then
   validate emulator process permissions, ROM mount points, and SQLite paths on
   RG34XX / RG35XX / RG40XX / RG CubeXX hardware.
4. Re-run the stub adapter suite on device before enabling real launches, then
   record true playtime against an installed RetroArch + core.
