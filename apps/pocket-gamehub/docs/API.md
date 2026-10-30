# API

All routes are rooted at `/api`. JSON errors use `{"error":{"code":"...","message":"..."}}`.

| Method | Route | Contract |
|---|---|---|
| GET | `/health` | version, emulator state/detail, metadata provider/mock state |
| GET | `/home` | continue_playing, recently_played, favorites, recently_added, collections |
| GET | `/games?q=&platform=&page=&limit=` | filtered paginated game array |
| GET | `/games/{id}` | one game object |
| GET | `/platforms` | platform names and game counts |
| GET/POST | `/favorites` | list; add using `{game_id}` |
| DELETE | `/favorites/{game_id}` | remove favorite |
| GET/POST | `/collections` | list; create using `{name,description?}` |
| GET/PUT/DELETE | `/collections/{id}` | read, update, delete collection |
| POST/DELETE | `/collections/{id}/games` | add/remove `{game_id}` membership |
| GET | `/search?q=` | search title, platform, developer, publisher |
| POST | `/launch` | `{game_id}` starts external process and records launch |
| POST | `/launch/{session_id}/stop` | close session and accumulate playtime (normally process exit is automatic) |
| GET | `/history?limit=` | sessions with launch/exit, duration, exit code |
| GET | `/cover/{game_id}` | SVG cover placeholder bytes |
| GET | `/screenshots/{game_id}` | screenshot records |
| POST | `/scan` | start scan; `{path}` overrides root, `{cancel:true}` requests cancellation |
| GET | `/scan/status` | progress and added/updated/unchanged counters |
| POST | `/metadata/scrape` | scrape request; unavailable provider returns `metadata_not_configured` |
| GET/PUT | `/settings` | read and update setting key/value object |

The development Vite server proxies `/api` to `localhost:8080`.
