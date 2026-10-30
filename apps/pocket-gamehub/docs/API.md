# API

All routes are rooted at `/api`. Errors use `{"error":{"code":"...","message":"..."}}`
with a status code matching the failure: `400` malformed input, `404` unknown
record, `405` wrong method, `409` conflict (duplicate name, no ROM), `501`
provider not configured.

## Routes

| Method | Route | Contract |
|---|---|---|
| GET | `/health` | `version`, `gamed_version`, `emulator` (`available`\|`not-installed`), `emulator_detail`, `metadata_provider`, `metadata_mock` |
| GET | `/home` | `continue_playing`, `recently_played`, `favorites`, `recently_added`, `collections` |
| GET | `/games?q=&platform=&page=&limit=` | filtered, paginated game array (`limit` 1–200, default 100) |
| GET | `/games/{id}` | one game object; `404 game_not_found` when absent |
| GET | `/platforms` | `[{name, game_count}]` |
| GET | `/favorites` | favourite games |
| POST | `/favorites` | add `{game_id}` → `201 {game_id, favorite:true}` |
| DELETE | `/favorites/{game_id}` | remove → `204` |
| GET | `/collections` | `[{id, name, description, game_ids}]` — member ids included for client-side filtering |
| POST | `/collections` | create `{name, description?}` → `201` with the new record |
| GET | `/collections/{id}` | `{id, name, description, games:[...]}` |
| PUT | `/collections/{id}` | rename/re-describe `{name, description?}` → updated record |
| DELETE | `/collections/{id}` | remove → `204` (`404` if unknown) |
| POST | `/collections/{id}/games` | add member `{game_id}` → `200 {collection_id, game_id, added}` |
| DELETE | `/collections/{id}/games` | remove member `{game_id}` → `200 {collection_id, game_id, removed}` |
| GET | `/search?q=` | matches title, platform, developer, publisher |
| POST | `/launch` | `{game_id}` starts the external emulator, inserts a history row, returns `202` with the session; `409 rom_missing` when the game has no ROM |
| POST | `/launch/{session_id}/stop` | close the session early; process exit also closes it automatically. Both paths are idempotent and accumulate playtime exactly once |
| GET | `/history?limit=` | sessions with `launch_at`, `exit_at`, `duration`, `exit_code` |
| GET | `/cover/{game_id}` | SVG cover placeholder (`image/svg+xml`) |
| GET | `/screenshots/{game_id}` | screenshot records |
| POST | `/scan` | start scan; `{path}` overrides the configured root, `{cancel:true}` requests cancellation. `409 scan_running` if one is active |
| GET | `/scan/status` | `running`, `progress`, `discovered`, `added`, `updated`, `unchanged`, `removed`, `cancelled`, `error` |
| POST | `/metadata/scrape` | `{game_ids?}` or `{all:true}`; without configured credentials returns `501 metadata_not_configured` |
| GET | `/settings` | stored setting key/value object |
| PUT | `/settings` | merge JSON object of settings |

## Game object

```json
{
  "id": 1, "title": "Advance Wars", "platform": "GBA",
  "rom_path": "/roms/GBA/advance-wars.gba",
  "developer": "Mock Studio", "publisher": "Mock Publisher",
  "description": "…", "genre": "Action", "release_date": "1998-01-01",
  "cover_url": "mock://cover/1", "favorite": false,
  "play_count": 0, "last_played": "2026-10-30T06:00:00Z",
  "play_time": 0, "metadata_status": "mock"
}
```

`play_time` is seconds accumulated from session launch/exit timestamps only.

## Development proxy

The Vite server proxies `/api` to `GAMEHUB_API_TARGET` (default
`http://localhost:8080`), for both `vite dev` and `vite preview`.
