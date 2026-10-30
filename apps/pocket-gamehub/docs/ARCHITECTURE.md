# Architecture

```text
React + TypeScript + Vite
  GameAPI / StorageAPI / MediaAPI / SystemAPI (HTTP defaults)
       | JSON /api
       v
Go gamed (:8080)
   |-- modernc.org/sqlite database
   |-- ROM scanner and metadata provider
   `-- EmulatorAdapter -> RetroArch / external program -> core -> ROM
```

The browser never opens ROM files, databases, or emulator processes. All system operations cross the four typed frontend capability interfaces and the gamed REST API. SQLite migrations create schema and seed the mock catalogue on first startup. Mock metadata is the default so the library remains demonstrable without credentials. ROM scans walk a configured root, infer platforms from folder and extension, detect changed files by mtime and size, and report progress through `/api/scan/status`; same stem CUE/BIN files are represented by one CUE game entry.

`RetroArchAdapter` launches the external CLI with `-L <core> <rom> --appendconfig=<config>` when configured. Process exit is watched and persisted to history. `SaveState`/`LoadState` require an available RetroArch command channel and explicitly report unsupported in the current desktop process adapter; no save-state format is reimplemented.
