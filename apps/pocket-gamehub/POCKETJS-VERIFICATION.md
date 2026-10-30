# POCKETJS VERIFICATION — pocket-gamehub

Round: PocketJS refactor. Device acceptance is a later pass.

## Shape

- Pocket app: `apps/pocket-gamehub/pocket/`
- Frozen React reference: `apps/pocket-gamehub/frontend/` (design reference; not extended).
- TSX files in the port: **6** (`main.tsx`, `app.tsx`, `ui.tsx`, three screens).
- Native tree only: `View`/`Text` from `@pocketjs/framework/solid/components`; no DOM, iframe, texture screenshot, or `dangerouslySetInnerHTML`.

## Manifest

- id: `dev.pocket-gamehub.pocket`
- entry: `src/main.tsx`
- output: `pocket-gamehub`
- viewport: `360×240 @2x` → physical `720×480`
- capabilities: `text.glyphs.baked`, `input.buttons`
- target: `rocknix-h700-kms`

## Admission / compile

```sh
cd apps/pocket-gamehub/pocket
./setup-sdk.sh
SDK=${POCKETJS_SDK:-$HOME/development/.pocketjs-star-drift-sdk}
bun "$SDK/tools/pocket.ts" check \
  --runtime-config "$POCKET_VERIFY/pjs/profiles/pocket.runtime-config.ts" \
  --target rocknix-h700-kms --manifest pocket.json
bun "$SDK/tools/pocket.ts" compile \
  --runtime-config "$POCKET_VERIFY/pjs/profiles/pocket.runtime-config.ts" \
  --target rocknix-h700-kms --manifest pocket.json --output out.pocket
```

Admission: `sha256:5c38896aa82443ed5b024035905adb4b51429588d42d8c659d91e30fcb785a48`; TypeScript passes for the app module graph. Package: `out.pocket`, sha256 `5beb6e2450833fbf78829ad63a2c845022cd5b9a6d851dfe9c13bc2b43740bed`.

## Frames

Rendered with the SDK wasm core at `renderScaled(2)` (720×480), not a browser:

```sh
cd "$POCKET_VERIFY"
bun tools/render-pocket.ts \
  --dir repos/pocket-gamehub/apps/pocket-gamehub/pocket \
  --script repos/pocket-gamehub/apps/pocket-gamehub/pocket/frames.json \
  --out repos/pocket-gamehub/docs/pocket
```

| file | state | sha256 (first 16) |
|---|---|---|
| `docs/pocket/screen-home.png` | home | `d972e2ed22bb6ce3` |
| `docs/pocket/screen-home-focus.png` | home-focus | `dba429f942466320` |
| `docs/pocket/screen-detail.png` | detail | `88630020644e0118` |
| `docs/pocket/screen-detail-action.png` | detail-action | `09b19678c7441e89` |
| `docs/pocket/screen-settings.png` | settings | `7853da3c793d0713` |
| `docs/pocket/screen-settings-toggled.png` | settings-toggled | `ada4e6df8a80b8ac` |

All six files have distinct bytes; the renderer rejects duplicate frames. The
tape is: move focus, open the item, run the first detail action, switch to
settings, move a row, toggle it.

Screens: Recently played/platforms, game detail, library settings. Interactions: LAUNCH reports the stub adapter; FAV and SCAN update visible state.

## Adapter

- **fixture** — this port runs from JSON baked into the package and labels the
  header `fixture`. `client.ts` also contains the `http` and `bridge` adapters
  behind the same `list()/get()/action()` surface.
- `http` uses `@pocketjs/framework/net-api`; valid only in the host dev profile.
- `bridge` uses `host.__pvc(JSON.stringify(request))`; the runtime forwards to
  the Go daemon on `127.0.0.1:<port>` with a hard timeout.
- Device gap: gamed bridge and an emulator/ROM mount. The device image has neither.
- Daemon contract: /api/home, /api/games, /api/platforms; launch is a stub adapter.

## Not done / open questions

- Device run, saves/annotations and the bridge itself are out of this round.
- Real media/audio, OAuth, emulator, engine and system writes stay unimplemented
  where the original product already marked them mock or unavailable.
- Long lists use the six-item fixture surface; paging/virtual lists are a
  follow-up once the bridge provides paginated data.
