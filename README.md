# Pocket GameHub


> **PocketJS port (product target):** `apps/pocket-gamehub/pocket/` is the
> native PocketJS program (Solid TSX → `.pocket` → `pocket-linux-kms`). The
> `frontend/` tree remains the frozen React design reference and is not
> extended. Frames: `docs/pocket/`; verification:
> `apps/pocket-gamehub/POCKETJS-VERIFICATION.md`.

A handheld-first game library and launcher for PJOS — Steam Deck Home and
EmulationStation ergonomics, built as the first PJOS reference application.

The React/Vite client never touches ROMs, SQLite, or emulator processes. Every
system capability goes through `GameAPI` / `StorageAPI` / `MediaAPI` /
`SystemAPI` into `gamed`, the single Go service that owns discovery, metadata,
persistence and external emulator launch. Pocket GameHub is **not** an
emulator: it drives RetroArch, PPSSPP or any standalone executable.

```text
React + TypeScript + Vite  ──HTTP/JSON──▶  gamed (Go)
                                             ├── SQLite (modernc.org/sqlite)
                                             ├── Metadata providers
                                             └── EmulatorAdapter ─▶ RetroArch
```

## Quick start

```bash
make run     # gamed on :18470 + Vite dev server on :18480
make test    # Go tests, i18n check, tsc, production build, API integration suite
```

Open <http://127.0.0.1:18480/>. Frontend dependencies install once with
`cd apps/pocket-gamehub/frontend && npm install`. Ports are configurable:
`GAMEHUB_ADDR` for the service, `GAMEHUB_API_TARGET` for the Vite proxy.

## Layout

```text
apps/pocket-gamehub/
  backend/    gamed (Go): store, scanner, adapters, metadata, HTTP API
  frontend/   React + Vite + TypeScript UI
  tests/      end-to-end API contract suite
  docs/       architecture, API, database, dependencies, roadmap, screenshots
```

## Documentation

- [Architecture](apps/pocket-gamehub/docs/ARCHITECTURE.md)
- [API reference](apps/pocket-gamehub/docs/API.md)
- [Database schema](apps/pocket-gamehub/docs/DATABASE.md)
- [Dependencies and environment](apps/pocket-gamehub/docs/DEPENDENCIES.md)
- [Roadmap and limitations](apps/pocket-gamehub/docs/ROADMAP.md)
- [Screenshots](apps/pocket-gamehub/docs/SCREENSHOTS.md)

## Status

The library, discovery, metadata, adapter and UI surface is implemented and
covered by tests. RetroArch, libretro cores and ROMs are absent from the current
development machine, so gameplay is verified only through a stub executable that
asserts the real CLI contract — see DEPENDENCIES.md for what a real device needs.
