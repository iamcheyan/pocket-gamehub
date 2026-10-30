# Database

`gamed` uses the pure-Go `modernc.org/sqlite` driver. Startup enables foreign keys, creates tables, records the schema migration version, and seeds 120 mock entries when the games catalogue is empty.

- `games`: title, platform, ROM path, metadata fields/status, favorite, play count, last played, play time, and scanner mtime/size.
- `platforms`: platform names.
- `collections`, `collection_games`: named groups and membership.
- `favorites`: game favorite relation, mirrored to `games.favorite` for convenient library queries.
- `history`: each process session's launch/exit timestamps, elapsed seconds, and exit code.
- `screenshots`: screenshot metadata records.
- `settings`: JSON encoded key/value preferences.
- `schema_migrations`: applied schema version.

`GAMEHUB_DB` selects the SQLite file; default is `gamehub.db` in the backend working directory.
