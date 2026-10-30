#!/usr/bin/env bash
# End-to-end API contract check for gamed.
#
# Starts the real service against a throwaway database and a temporary ROM
# root, then exercises every documented route and asserts the response
# contract. Exits non-zero on the first broken expectation.
#
# Usage: apps/pocket-gamehub/tests/api-smoke.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BACKEND="$ROOT/apps/pocket-gamehub/backend"
WORK="$(mktemp -d)"
PORT="${GAMEHUB_TEST_PORT:-18573}"
BASE="http://127.0.0.1:$PORT"
PASS=0
FAIL=0

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

ok() { PASS=$((PASS + 1)); printf '  ok   %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf '  FAIL %s\n' "$1"; }

# expect_status <description> <expected> <curl args...>
expect_status() {
  local desc="$1" want="$2"; shift 2
  local got
  got="$(curl -sS -o "$WORK/body" -w '%{http_code}' "$@" || true)"
  if [ "$got" = "$want" ]; then ok "$desc ($got)"; else
    bad "$desc (got $got, want $want): $(head -c 200 "$WORK/body")"
  fi
}

# expect_json <description> <jq filter>
expect_json() {
  local desc="$1" filter="$2"
  if out="$(jq -er "$filter" <"$WORK/body" 2>/dev/null)"; then ok "$desc -> $out"; else
    bad "$desc: jq '$filter' failed on $(head -c 200 "$WORK/body")"
  fi
}

printf 'gamed API smoke test\n'
mkdir -p "$WORK/roms/GB" "$WORK/roms/GBA" "$WORK/roms/PS1" "$WORK/roms/NDS"
: >"$WORK/roms/GB/alpha.gb"
: >"$WORK/roms/GBA/beta.gba"
printf 'CUE' >"$WORK/roms/PS1/disc.cue"
printf 'BIN' >"$WORK/roms/PS1/disc.bin"
: >"$WORK/roms/NDS/gamma.nds"

(cd "$BACKEND" && GAMEHUB_DB="$WORK/gamehub.db" GAMEHUB_ADDR="127.0.0.1:$PORT" \
  GAMEHUB_ROMS="$WORK/roms" go run . >"$WORK/server.log" 2>&1) &
SERVER_PID=$!

for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "$BASE/api/health" 2>/dev/null; then break; fi
  sleep 0.25
done

printf '\nhealth\n'
expect_status "GET /api/health" 200 "$BASE/api/health"
expect_json "gamed version" '.gamed_version'
expect_json "emulator state reported" '.emulator'
expect_json "metadata provider named" '.metadata_provider'
expect_json "mock flag present" '.metadata_mock | type'
expect_json "emulator not-installed in this environment" '.emulator == "not-installed" or .emulator == "available"'

printf '\ncatalogue\n'
expect_status "GET /api/games" 200 "$BASE/api/games?limit=5"
expect_json "seeded catalogue has 100+ games" 'length >= 5'
expect_json "game carries required fields" '.[0] | has("title") and has("platform") and has("play_count") and has("play_time") and has("metadata_status")'
expect_status "GET /api/games/{id}" 200 "$BASE/api/games/1"
expect_json "detail is a single object" 'type == "object" and has("id")'
expect_status "GET /api/games/999999" 404 "$BASE/api/games/999999"
expect_json "404 uses structured error" '.error.code == "game_not_found"'
expect_status "GET /api/platforms" 200 "$BASE/api/platforms"
expect_json "platforms report counts" '.[0] | has("name") and has("game_count")'
expect_status "GET /api/home" 200 "$BASE/api/home"
expect_json "home exposes all sections" 'has("continue_playing") and has("recently_played") and has("favorites") and has("recently_added") and has("collections")'

printf '\nsearch\n'
expect_status "GET /api/search?q=Mario" 200 "$BASE/api/search?q=Mario"
expect_json "search matches by title" 'length > 0'
expect_status "search by platform" 200 "$BASE/api/search?q=GBA"
expect_status "search by developer" 200 "$BASE/api/search?q=Mock%20Studio"
expect_json "developer search matches" 'length > 0'

printf '\nfavorites\n'
expect_status "POST /api/favorites" 201 -X POST -H 'content-type: application/json' -d '{"game_id":2}' "$BASE/api/favorites"
expect_status "GET /api/favorites" 200 "$BASE/api/favorites"
expect_json "favorite appears in list" 'any(.[]; .id == 2)'
expect_status "DELETE /api/favorites/{id}" 204 -X DELETE "$BASE/api/favorites/2"
expect_status "favorites empty after delete" 200 "$BASE/api/favorites"
expect_json "favorite removed" 'map(.id) | index(2) == null'

printf '\ncollections\n'
expect_status "POST /api/collections" 201 -X POST -H 'content-type: application/json' -d '{"name":"Smoke"}' "$BASE/api/collections"
CID="$(jq -er '.id' <"$WORK/body")"
ok "collection id $CID"
expect_status "GET /api/collections" 200 "$BASE/api/collections"
expect_json "collection listed with member ids" "any(.[]; .id == $CID and (.game_ids | type) == \"array\")"
expect_status "POST /api/collections/{id}/games" 200 -X POST -H 'content-type: application/json' -d '{"game_id":3}' "$BASE/api/collections/$CID/games"
expect_status "GET /api/collections/{id}" 200 "$BASE/api/collections/$CID"
expect_json "membership added" 'any(.games[]; .id == 3)'
expect_status "list exposes membership ids" 200 "$BASE/api/collections"
expect_json "game_ids tracks membership" "any(.[]; .id == $CID and (.game_ids | index(3)) != null)"
expect_status "PUT /api/collections/{id}" 200 -X PUT -H 'content-type: application/json' -d '{"name":"Smoke renamed","description":"d"}' "$BASE/api/collections/$CID"
expect_json "collection renamed" '.name == "Smoke renamed"'
expect_status "DELETE /api/collections/{id}/games" 200 -X DELETE -H 'content-type: application/json' -d '{"game_id":3}' "$BASE/api/collections/$CID/games"
expect_status "membership removed" 200 "$BASE/api/collections/$CID"
expect_json "collection empty again" '.games | length == 0'
expect_status "DELETE /api/collections/{id}" 204 -X DELETE "$BASE/api/collections/$CID"

printf '\nrom scan\n'
expect_status "POST /api/scan" 202 -X POST -H 'content-type: application/json' -d "{\"path\":\"$WORK/roms\"}" "$BASE/api/scan"
sleep 1.5
expect_status "GET /api/scan/status" 200 "$BASE/api/scan/status"
expect_json "scan finished" '.running == false'
expect_json "four ROMs discovered (cue+bin merged)" '.added == 4'
expect_json "no scan error" '.error == ""'
expect_status "scanned GBA game present" 200 "$BASE/api/games?q=beta"
expect_json "extension/directory platform inference" '.[0].platform == "GBA"'
expect_status "scanned PS1 cue present" 200 "$BASE/api/games?q=disc"
expect_json "cue+bin grouped as one PS1 disc" '(length == 1) and (.[0].platform == "PS1")'
expect_status "rescan is incremental" 202 -X POST -H 'content-type: application/json' -d "{\"path\":\"$WORK/roms\"}" "$BASE/api/scan"
sleep 1.5
expect_status "scan status after rescan" 200 "$BASE/api/scan/status"
expect_json "rescan reports unchanged" '.unchanged == 4 and .added == 0'

printf '\nmetadata\n'
expect_status "POST /api/metadata/scrape unconfigured" 501 -X POST -H 'content-type: application/json' -d '{"all":true}' "$BASE/api/metadata/scrape"
expect_json "explicit metadata_not_configured" '.error.code == "metadata_not_configured"'

printf '\nmedia and settings\n'
expect_status "GET /api/cover/{id}" 200 "$BASE/api/cover/1"
if head -c 4 "$WORK/body" | grep -q '<svg'; then ok "cover returns SVG bytes"; else bad "cover is not SVG"; fi
expect_status "GET /api/screenshots/{id}" 200 "$BASE/api/screenshots/1"
expect_json "screenshot list is an array" 'type == "array"'
expect_status "PUT /api/settings" 200 -X PUT -H 'content-type: application/json' -d '{"theme":"dark","language":"ja"}' "$BASE/api/settings"
expect_json "settings persisted" '.theme == "dark" and .language == "ja"'
expect_status "GET /api/settings" 200 "$BASE/api/settings"
expect_json "settings round-trip" '.theme == "dark"'

printf '\nlaunch without emulator\n'
expect_status "POST /api/launch with no ROM path" 409 -X POST -H 'content-type: application/json' -d '{"game_id":1}' "$BASE/api/launch"
expect_json "launch rejection explains missing ROM" '.error.code == "rom_missing"'

printf '\nhistory\n'
expect_status "GET /api/history" 200 "$BASE/api/history?limit=5"
expect_json "history is an array" 'type == "array"'

printf '\n'
printf 'passed %d, failed %d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
