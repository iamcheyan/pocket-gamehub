# gamed

Go REST backend for Pocket GameHub. It listens on `:8080` by default and serves JSON under `/api`. SQLite is created at `gamehub.db` using the pure Go `modernc.org/sqlite` driver. The first start seeds 120 mock catalog entries.

```sh
cd apps/pocket-gamehub/backend
go run .
```

Configure with `GAMEHUB_ADDR`, `GAMEHUB_DB`, `GAMEHUB_ROMS`, `RETROARCH`, `RETROARCH_CORE`, and `RETROARCH_CONFIG`. ROM scans can also pass `{"path":"/path/to/ROMS"}` to `POST /api/scan`; pass `{"cancel":true}` to request cancellation. A launch requires a discovered ROM path and an installed compatible emulator. ScreenScraper requests return `metadata_not_configured` until credentials/provider support are configured. Mock games are catalog demos and cannot be launched.
RetroArch receives `-L <core> <rom> --appendconfig=<config>` when `RETROARCH_CORE` and `RETROARCH_CONFIG` are set. Its process is waited asynchronously; exit time, exit code, and elapsed playtime are written automatically. The stop route remains available and is idempotent.
ScreenScraper provider configuration uses `SCREENSCRAPER_USERNAME`, `SCREENSCRAPER_PASSWORD`, and `SCREENSCRAPER_DEVELOPER_ID`. With missing credentials or no configured API client, scrape requests explicitly report `metadata_not_configured`.

## API interface

- `GET /api/health` returns `version`, `gamed_version`, `emulator` (`available` or `not-installed`), `emulator_detail`, `metadata_provider`, and `metadata_mock`.
- `GET /api/games?q=&platform=&page=&limit=` returns a JSON array. `GET /api/games/{id}` returns a game object or a structured 404.
- `GET /api/home` returns `continue_playing`, `recently_played`, `favorites`, `recently_added`, and `collections` arrays.
- `GET /api/platforms` returns `{name,game_count}` objects; `GET /api/favorites` returns games. Favorite mutations use `POST /api/favorites {game_id}` and `DELETE /api/favorites/{game_id}`.
- Collections use `GET/POST /api/collections`, `GET/PUT/DELETE /api/collections/{id}`, and `POST/DELETE /api/collections/{id}/games` with `{game_id}`.
- `GET /api/search?q=` searches title, platform, developer, and publisher. `GET /api/history?limit=` returns session records.
- `POST /api/launch {game_id}` starts a game and returns session `{id,game_id,launch_at}`. `POST /api/launch/{id}/stop` closes its history record and adds elapsed seconds to play time.
- `GET /api/cover/{game_id}` returns an SVG cover placeholder as `image/svg+xml`. `GET /api/screenshots/{game_id}` lists screenshot records.
- `POST /api/scan` starts or cancels discovery; `GET /api/scan/status` returns running/progress/discovered/added/updated/unchanged. A same-stem `.cue` and `.bin` is one PS1 game entry.
- `POST /api/metadata/scrape` returns HTTP 501 and `metadata_not_configured`. `GET/PUT /api/settings` reads and writes JSON settings.

Errors use `{"error":{"code":"...","message":"..."}}`.
