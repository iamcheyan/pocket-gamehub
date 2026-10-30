# Architecture

```text
React + TypeScript + Vite (frontend/src)
  GameAPI / StorageAPI / MediaAPI / SystemAPI   ← TS interfaces, HTTP defaults
                       │ JSON over /api
                       ▼
gamed (backend/, Go)                            ← the only business entry point
  api.go        HTTP routes, JSON/error envelope, HTTP status semantics
  store.go      SQLite connection, ordered migrations, mock seeding
  scanner.go    ROM discovery, platform inference, incremental sync
  adapters.go   EmulatorAdapter: RetroArch / PPSSPP / standalone process
  metadata.go   MetadataProvider: mock (default) or ScreenScraper
  main.go       configuration and process wiring
                       │
                       ├── SQLite (modernc.org/sqlite, pure Go)
                       ├── Metadata provider
                       └── EmulatorAdapter ──▶ RetroArch ──▶ libretro core ──▶ ROM
```

The browser never opens ROM files, a database, or an emulator process. Every
capability crosses one of the four typed frontend interfaces and then the REST
API; replacing those interfaces with PocketJS Runtime bindings is the intended
PJOS migration path.

## Request path

1. A view calls `GameAPI` / `StorageAPI` / `MediaAPI` / `SystemAPI`.
2. The HTTP default implementation issues `fetch('/api/…')`; the Vite dev and
   preview servers proxy that to `GAMEHUB_API_TARGET`.
3. `gamed` validates input, performs the SQLite work, and returns JSON. Errors
   use `{"error":{"code","message"}}` with a meaningful status code.
4. The UI renders the result. It holds no persistent state of its own: theme,
   language, favourites and collections all live in `gamed`.

## Discovery

`scanner.go` walks the configured root, maps extensions (`.gb`, `.gbc`, `.gba`,
`.nes`, `.sfc`, `.smc`, `.nds`, `.chd`, `.cue`, `.iso`, plus PSP `.pbp`/`.cso`)
and cross-checks the parent directory, so a mislabelled extension does not
silently land in the wrong platform. A `.cue` and its same-stem `.bin` collapse
into one disc entry whose size/mtime covers both files. Rescans compare mtime
and size, count `added`/`updated`/`unchanged`, prune rows whose file vanished
(bounded to the scan root), and can be cancelled between files.

## Emulator boundary

`RetroArchAdapter.Launch` executes the real CLI contract
`retroarch -L <core> <rom> --appendconfig=<config>` and returns a session; a
watcher waits for process exit and writes `exit_at`, `exit_code` and
`duration` to `history`. Playtime is derived only from those timestamps.
`SaveState`/`LoadState` require a command channel and explicitly report
unsupported — no save-state format is reimplemented.
