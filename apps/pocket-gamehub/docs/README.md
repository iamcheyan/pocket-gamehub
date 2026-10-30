# Pocket GameHub

Pocket GameHub is a handheld first library and launch frontend for PJOS. The React/Vite client talks only to `gamed` over JSON HTTP. `gamed` owns SQLite, ROM discovery, metadata providers, and external emulator processes. The project does not implement an emulator.

## Run

Requirements: Go, Node.js/npm, and (for an actual game launch) RetroArch plus a matching libretro core and ROM. From the repository root run `make run`; open http://127.0.0.1:5173. The UI and service use a temporary database for this command. To persist data, run the backend directly with `GAMEHUB_DB=/path/to/gamehub.db`, then run Vite in the frontend directory. Set `GAMEHUB_ROMS` to the ROM root and `RETROARCH`, `RETROARCH_CORE`, and `RETROARCH_CONFIG` as needed.

Run the checks with `make test`. See [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [DATABASE.md](DATABASE.md), [DEPENDENCIES.md](DEPENDENCIES.md), [ROADMAP.md](ROADMAP.md), and [SCREENSHOTS.md](SCREENSHOTS.md).
