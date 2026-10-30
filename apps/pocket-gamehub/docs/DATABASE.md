# Database

`gamed` uses the pure-Go `modernc.org/sqlite` driver — no cgo, no `sqlite3` CLI.
`GAMEHUB_DB` selects the file; the default is `gamehub.db` in the backend
working directory. `:memory:` is used by tests.

## Migrations

`Open` enables foreign keys, then applies ordered migrations from the
`migrations` slice. Each entry runs in its own transaction and records its
version in `schema_migrations`, so a database upgraded from an older build only
runs the missing steps. `schemaVersion` is the highest version currently known;
`TestMigrationVersionRecorded` asserts the recorded value and the presence of
every required table.

## Tables

| Table | Purpose |
|---|---|
| `games` | title, platform, `rom_path` (unique), metadata fields and `metadata_status`, `favorite`, `play_count`, `last_played`, `play_time` (seconds), plus scanner `mtime`/`size` |
| `platforms` | platform name registry |
| `collections` | named groups (`name` unique, `description`) |
| `collection_games` | membership, cascades on collection/game delete |
| `favorites` | favourite relation; `games.favorite` mirrors it for single-query listing |
| `history` | one row per launch: `id`, `game_id`, `launch_at`, `exit_at`, `duration`, `exit_code` |
| `screenshots` | screenshot metadata records per game |
| `settings` | JSON-encoded key/value preferences (theme, language, …) |
| `schema_migrations` | applied migration versions |

## Seeding

When `games` is empty, 120 entries are inserted from a fixed title/platform
table so the UI is demonstrable without credentials. Titles are recognisable
placeholders (e.g. *Advance Wars*, *Chrono Trigger*, *Metal Gear Solid*), all
marked `metadata_status = 'mock'`. No licensed artwork or metadata is bundled.

## Playtime accounting

`history.duration` is written when a session closes — by process exit or by
`POST /api/launch/{id}/stop`. Both paths update `history` with
`WHERE exit_at IS NULL` and only add the duration to `games.play_time` when a
row actually changed, so playtime accumulates exactly once per session.
