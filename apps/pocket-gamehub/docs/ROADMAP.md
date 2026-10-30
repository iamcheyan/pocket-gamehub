# Roadmap and limitations

## Implemented

- Go gamed REST service with version/RetroArch health probe, SQLite schema setup, 120 seeded mock games, favorites, collections, history, settings, search, home sections, and cover SVGs.
- ROM scan with progress/cancel, extension and platform detection, CUE/BIN grouping, and mtime/size incremental accounting.
- RetroArch CLI adapter with stub-tested argv and exit history; PPSSPP/standalone external adapter types.
- React/Vite handheld UI, GameAPI/StorageAPI/MediaAPI/SystemAPI HTTP boundaries, responsive layouts, keyboard/gamepad controls, three locales and three themes.
- `make run` and `make test` entry points; architecture/API/database/dependency/screenshot docs.

## Known limitations

- RetroArch, cores, ROMs, and a display server are not available in the development environment. Only the stub adapter path can be verified here; actual gameplay is not claimed.
- ScreenScraper credentials are absent and its authenticated HTTP client is not implemented. Scrape calls return `metadata_not_configured`.
- RetroArch save/load state needs an in-process command channel; the adapter returns an explicit unsupported error. Screenshot records can be queried, but live capture is not implemented.
- UI screenshots and exact responsive usability require real browser capture; see SCREENSHOTS.md for generated evidence and remaining layout limits.

## PJOS migration

Keep gamed as the only data/emulator entry point. Replace the default HTTP implementations behind GameAPI, StorageAPI, MediaAPI, and SystemAPI with PocketJS Runtime bindings, preserving their TypeScript contracts. Package the frontend/backend according to the `.pj` and Pocket Runtime lifecycle once those runtime contracts are available. Validate external emulator process permissions and storage paths on target hardware.
