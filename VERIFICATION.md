# Verification — pocket-gamehub @ 2026-10-31

- Verdict: PASS
- Commit: `6bb7c40213bc849b3698fab9d888b1bc0afc981b` (fixes + screenshots; this document is the following commit)
- Remote: `6bb7c40213bc849b3698fab9d888b1bc0afc981b`
- Runtime: `gamed` on `127.0.0.1:18470` (fresh temp SQLite, 120-item mock catalogue) + `vite preview` production build on `127.0.0.1:18480`
- Toolchain: go 1.26.0, node v22.23.3, Chrome 155.0.8059.84; RetroArch/ROMs absent (honest offline state)

## Test gate
| command | result | notes |
|---|---|---|
| `go vet ./...` | PASS | gamed |
| `go test ./...` | PASS | 12 Go tests (store, scanner, adapters, metadata, API), 0 failures |
| `npm run i18n:check` | PASS | translation key parity |
| `npx tsc --noEmit` | PASS | frontend typecheck |
| `npm run build` | PASS | production Vite bundle |
| `tests/api-smoke.sh` | PASS | 69 API checks, 0 failures |
| `tests/ui-320x240-flow.mjs` | PASS | real 320×240 browse → detail → favourite → launch flow, every check ok |
| `tests/ui-input-mapping.mjs` | PASS | keyboard + gamepad mapping panel: all checks ok |

`make test` runs the Go/i18n/tsc/build/API gates; green. `make test-ui` runs both real-browser flows against the live stack; green.

## Runtime
`GET /api/health` → `gamed 0.1.0`, `metadata_provider: mock`, `metadata_mock: true`,
`emulator: not-installed` with `emulator_detail: not-installed`. The UI therefore shows the
offline/launch-unavailable state instead of pretending a game can start — the 320×240 flow
test asserts the launch control is visible, disabled and states the unavailability.

## Screenshot matrix
All 57 files were regenerated this run by the new repo script
`apps/pocket-gamehub/tests/capture-screenshots.mjs` (puppeteer-core + system Chrome). The UI has
no URL router, so the script clicks the real nav buttons, the GBA platform chip, the first game
card and the search box; backend theme/language settings are reset before each capture. It
writes `docs/screenshots/manifest.json` with the run timestamp and every SHA-256.

| screen | viewport | file | note |
|---|---|---|---|
| home | 320x240 | `apps/pocket-gamehub/docs/screenshots/home-320x240.png` | sha256 0f55e5e2bec05fca |
| library | 320x240 | `apps/pocket-gamehub/docs/screenshots/library-320x240.png` | sha256 8b4eaa82e1c86ed0 |
| platform | 320x240 | `apps/pocket-gamehub/docs/screenshots/platform-list-320x240.png` | sha256 2e1dac027d11ce88 |
| detail | 320x240 | `apps/pocket-gamehub/docs/screenshots/detail-320x240.png` | sha256 e13bb5934598b817 |
| search | 320x240 | `apps/pocket-gamehub/docs/screenshots/search-320x240.png` | sha256 a04569a72cdd6ed5 |
| collections | 320x240 | `apps/pocket-gamehub/docs/screenshots/collections-320x240.png` | sha256 657a785c65af7d4d |
| settings | 320x240 | `apps/pocket-gamehub/docs/screenshots/settings-320x240.png` | sha256 963f0914d7fa7ef0 |
| dark | 320x240 | `apps/pocket-gamehub/docs/screenshots/dark-320x240.png` | sha256 68773abd237f8f6d |
| light | 320x240 | `apps/pocket-gamehub/docs/screenshots/light-320x240.png` | sha256 af8844e9f36df6d0 |
| home | 480x320 | `apps/pocket-gamehub/docs/screenshots/home-480x320.png` | sha256 0d30784e9a4bb744 |
| library | 480x320 | `apps/pocket-gamehub/docs/screenshots/library-480x320.png` | sha256 a0ee5e82b816ab0b |
| platform | 480x320 | `apps/pocket-gamehub/docs/screenshots/platform-list-480x320.png` | sha256 69c5f9b11c43a2cf |
| detail | 480x320 | `apps/pocket-gamehub/docs/screenshots/detail-480x320.png` | sha256 adc4daf4c656695e |
| search | 480x320 | `apps/pocket-gamehub/docs/screenshots/search-480x320.png` | sha256 53cc3fcf52992d54 |
| collections | 480x320 | `apps/pocket-gamehub/docs/screenshots/collections-480x320.png` | sha256 d387be12f7a58c20 |
| settings | 480x320 | `apps/pocket-gamehub/docs/screenshots/settings-480x320.png` | sha256 5417a1aa471aba67 |
| dark | 480x320 | `apps/pocket-gamehub/docs/screenshots/dark-480x320.png` | sha256 164f69f5e1dab6a7 |
| light | 480x320 | `apps/pocket-gamehub/docs/screenshots/light-480x320.png` | sha256 aa49abbf86e69850 |
| home | 640x480 | `apps/pocket-gamehub/docs/screenshots/home-640x480.png` | sha256 5e1a3558a691d47d |
| library | 640x480 | `apps/pocket-gamehub/docs/screenshots/library-640x480.png` | sha256 b5653275d53cef02 |
| platform | 640x480 | `apps/pocket-gamehub/docs/screenshots/platform-list-640x480.png` | sha256 e0a20148df4ff17b |
| detail | 640x480 | `apps/pocket-gamehub/docs/screenshots/detail-640x480.png` | sha256 584991fed20fc712 |
| search | 640x480 | `apps/pocket-gamehub/docs/screenshots/search-640x480.png` | sha256 193ef8e5f1c264d8 |
| collections | 640x480 | `apps/pocket-gamehub/docs/screenshots/collections-640x480.png` | sha256 7d4fdd29a8efb898 |
| settings | 640x480 | `apps/pocket-gamehub/docs/screenshots/settings-640x480.png` | sha256 2f2e5a4c0fb27c4f |
| dark | 640x480 | `apps/pocket-gamehub/docs/screenshots/dark-640x480.png` | sha256 190500e6ab96890e |
| light | 640x480 | `apps/pocket-gamehub/docs/screenshots/light-640x480.png` | sha256 cebaaf2666af38a7 |
| home | 720x720 | `apps/pocket-gamehub/docs/screenshots/home-720x720.png` | sha256 21803b0038460fe5 |
| library | 720x720 | `apps/pocket-gamehub/docs/screenshots/library-720x720.png` | sha256 98eaaaf8e504a28d |
| platform | 720x720 | `apps/pocket-gamehub/docs/screenshots/platform-list-720x720.png` | sha256 dbeef7c7072da0b1 |
| detail | 720x720 | `apps/pocket-gamehub/docs/screenshots/detail-720x720.png` | sha256 ee1c447971e4d4d0 |
| search | 720x720 | `apps/pocket-gamehub/docs/screenshots/search-720x720.png` | sha256 49347b82afb4fd1e |
| collections | 720x720 | `apps/pocket-gamehub/docs/screenshots/collections-720x720.png` | sha256 859b2735011450f7 |
| settings | 720x720 | `apps/pocket-gamehub/docs/screenshots/settings-720x720.png` | sha256 5dcf4ca72bcd42ee |
| dark | 720x720 | `apps/pocket-gamehub/docs/screenshots/dark-720x720.png` | sha256 cdf6492a17deebc4 |
| light | 720x720 | `apps/pocket-gamehub/docs/screenshots/light-720x720.png` | sha256 f02cfdeb076eca2e |
| home | 1280x720 | `apps/pocket-gamehub/docs/screenshots/home-1280x720.png` | sha256 692c5f6fbaa1a2a4 |
| library | 1280x720 | `apps/pocket-gamehub/docs/screenshots/library-1280x720.png` | sha256 43b254e75807362a |
| platform | 1280x720 | `apps/pocket-gamehub/docs/screenshots/platform-list-1280x720.png` | sha256 30ddbfbd7d310ab7 |
| detail | 1280x720 | `apps/pocket-gamehub/docs/screenshots/detail-1280x720.png` | sha256 5986a0d45f2c785d |
| search | 1280x720 | `apps/pocket-gamehub/docs/screenshots/search-1280x720.png` | sha256 8feb9fd2f9085801 |
| collections | 1280x720 | `apps/pocket-gamehub/docs/screenshots/collections-1280x720.png` | sha256 2f85c372b8c6adc0 |
| settings | 1280x720 | `apps/pocket-gamehub/docs/screenshots/settings-1280x720.png` | sha256 a3dd32cd11952936 |
| dark | 1280x720 | `apps/pocket-gamehub/docs/screenshots/dark-1280x720.png` | sha256 eeaebb06b6e75763 |
| light | 1280x720 | `apps/pocket-gamehub/docs/screenshots/light-1280x720.png` | sha256 f061b6e498b5abbb |
| home | 1920x1080 | `apps/pocket-gamehub/docs/screenshots/home-1920x1080.png` | sha256 352ebe68819ce9c5 |
| library | 1920x1080 | `apps/pocket-gamehub/docs/screenshots/library-1920x1080.png` | sha256 d26aa78400845e65 |
| platform | 1920x1080 | `apps/pocket-gamehub/docs/screenshots/platform-list-1920x1080.png` | sha256 f1c3b9de56b96627 |
| detail | 1920x1080 | `apps/pocket-gamehub/docs/screenshots/detail-1920x1080.png` | sha256 ab05b7eb2631a418 |
| search | 1920x1080 | `apps/pocket-gamehub/docs/screenshots/search-1920x1080.png` | sha256 332122c108210a23 |
| collections | 1920x1080 | `apps/pocket-gamehub/docs/screenshots/collections-1920x1080.png` | sha256 3b3249ce0d7f6c6b |
| settings | 1920x1080 | `apps/pocket-gamehub/docs/screenshots/settings-1920x1080.png` | sha256 5bb7512b73785a01 |
| dark | 1920x1080 | `apps/pocket-gamehub/docs/screenshots/dark-1920x1080.png` | sha256 b5e824849c254bc7 |
| light | 1920x1080 | `apps/pocket-gamehub/docs/screenshots/light-1920x1080.png` | sha256 9ca7d6d9863ec124 |
| dpi | 480x320 | `apps/pocket-gamehub/docs/screenshots/dpi-1_5x-720x480.png` | sha256 8193acf4bb68b2e2, dsf 1.5 |
| dpi | 480x320 | `apps/pocket-gamehub/docs/screenshots/dpi-2x-960x640.png` | sha256 5be3bfa63b263350, dsf 2 |
| dpi | 480x320 | `apps/pocket-gamehub/docs/screenshots/dpi-3x-1440x960.png` | sha256 3eef9842bf230bee, dsf 3 |

Count: 57 screenshots, 57 unique hashes (0 duplicates). `tools/check_shots.py`: all PNGs valid,
dimensions match the filename suffix (including the 1.5×/2×/3× DPI files), minimum per-image
RGB stddev above the blank threshold, no blank frames. The capture script additionally fails on
any horizontal overflow, missing text, duplicate hash, console error or HTTP ≥400; this run
passed all 57 probes.

## Fixed
- `make screenshots` did not exist and the 57 committed images had no reproducible script
  (they were produced by ad-hoc `chromium --screenshot` calls, which cannot drive the DOM-based
  navigation). → added `tests/capture-screenshots.mjs` (9 views × 6 viewports + 3 DPI, real DOM
  interaction, overflow/console/hash/size gates, manifest) and the `make screenshots` target
  → `apps/pocket-gamehub/tests/capture-screenshots.mjs`, `Makefile`.
- `make test-ui` hard-coded `CHROME_BIN=/run/current-system/sw/bin/chromium` and an absolute
  absolute home-directory puppeteer path, so the documented browser gates could not run on this Debian
  host. → `CHROME_BIN` now resolves `google-chrome`/`chromium`/`chromium-browser` on PATH and
  the puppeteer default uses `$(HOME)` → `Makefile` → both UI flows pass above.
- Every page logged a console 404 for `/favicon.ico`. → added
  `apps/pocket-gamehub/frontend/public/favicon.svg` and the `<link rel="icon">` in `index.html`;
  the 57-shot capture now ends with "no console errors" (the script fails otherwise).

## Blocked / open questions
- No emulator/BIOS/ROMs on this host, so launching a game is verified only up to the refusal
  path (`409` missing ROM / disabled launch); the adapter CLI contract is covered by the Go
  tests with a stub executable. This is the documented limitation, not a regression.

## Not verified here
- 掌机真机（RG34XX / PJOS-LINUX）未验证；本轮只在本机 headless Chrome 里跑真实进程。
- Real RetroArch gameplay, controller hardware, and real ROM scanning of a device filesystem.
