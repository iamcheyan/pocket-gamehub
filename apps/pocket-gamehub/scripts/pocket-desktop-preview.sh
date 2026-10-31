#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SDK=${POCKETJS_SDK:-$HOME/development/pjs-app-build}
FONT="$HOME/development/pocketshell/app/fonts"
export POCKETJS_FONT_REGULAR="$FONT/SarasaUiSC-Regular.ttf"
export POCKETJS_FONT_BOLD="$FONT/SarasaUiSC-Bold.ttf"
export POCKETJS_FONT_MONO="$FONT/SarasaUiSC-Regular.ttf"
cd "$SDK"
 bun tools/pocket.ts compile --runtime-config apps/pocket-gamehub/pocket.runtime-config.ts \
  --target linux-app --manifest apps/pocket-gamehub/pocket.json \
  --output "$ROOT/dist/gamehub-desktop.pocket"
 bun tools/pocket.ts build --config apps/pocket-gamehub/pocket.runtime-config.ts \
  --target linux-app --pocket "$ROOT/dist/gamehub-desktop.pocket" \
  --out /tmp/pocket-gamehub-desktop
exec /tmp/pocket-gamehub-desktop/program/run
