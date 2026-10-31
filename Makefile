ROOT := $(CURDIR)
BACKEND := apps/pocket-gamehub/backend
FRONTEND := apps/pocket-gamehub/frontend
TESTS := apps/pocket-gamehub/tests

# Browser tests need a Chromium and puppeteer-core. Override if they live
# elsewhere: make test-ui CHROME_BIN=... PUPPETEER_CORE=...
CHROME_BIN ?= /run/current-system/sw/bin/chromium
PUPPETEER_CORE ?= /home/tetsuya/.bun/install/global/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js

.PHONY: run test test-backend test-frontend test-integration test-ui test-ui-flow test-ui-input build pocket-build pocket-check

# One command for the whole app: gamed + Vite dev server (proxying /api).
run:
	@tmp=$$(mktemp -d); \
	(cd $(BACKEND) && GAMEHUB_DB="$$tmp/gamehub.db" GAMEHUB_ADDR=127.0.0.1:18470 go run .) & backend_pid=$$!; \
	(cd $(FRONTEND) && GAMEHUB_API_TARGET=http://127.0.0.1:18470 npm run dev -- --host 127.0.0.1 --port 18480 --strictPort) & frontend_pid=$$!; \
	trap 'kill $$backend_pid $$frontend_pid 2>/dev/null || true; rm -rf "$$tmp"' EXIT INT TERM; \
	echo "gamed:    http://127.0.0.1:18470/api/health"; \
	echo "frontend: http://127.0.0.1:18480/"; \
	wait $$backend_pid $$frontend_pid

test: test-backend test-frontend test-integration

test-backend:
	cd $(BACKEND) && go vet ./... && go test ./...

test-frontend:
	cd $(FRONTEND) && npm run i18n:check && npx tsc --noEmit && npm run build

test-integration:
	bash $(TESTS)/api-smoke.sh

# Require the app to be running (make run in another terminal). Drives the real
# UI: 320x240 flow (browse -> detail -> favourite -> launch) and the keyboard /
# gamepad mapping panel.
test-ui: test-ui-flow test-ui-input

test-ui-flow:
	CHROME_BIN=$(CHROME_BIN) PUPPETEER_CORE=$(PUPPETEER_CORE) node $(TESTS)/ui-320x240-flow.mjs

test-ui-input:
	CHROME_BIN=$(CHROME_BIN) PUPPETEER_CORE=$(PUPPETEER_CORE) node $(TESTS)/ui-input-mapping.mjs

POCKETJS_SDK ?= $(HOME)/development/pjs-app-build
GAMEHUB_POCKET := $(ROOT)/apps/pocket-gamehub/pocket
GAMEHUB_POCKET_OUT := $(ROOT)/apps/pocket-gamehub/dist/gamehub.pocket
GAMEHUB_APP := $(POCKETJS_SDK)/apps/pocket-gamehub
GAMEHUB_PROGRAM := $(POCKETJS_SDK)/programs/pocket-gamehub

pocket-build:
	mkdir -p $(GAMEHUB_APP) $(GAMEHUB_PROGRAM) $(ROOT)/apps/pocket-gamehub/dist
	rsync -a --delete $(GAMEHUB_POCKET)/ $(GAMEHUB_APP)/
	cp $(GAMEHUB_POCKET)/profile.ts $(GAMEHUB_PROGRAM)/profile.ts
	cp $(GAMEHUB_POCKET)/pocket.runtime-config.ts $(GAMEHUB_PROGRAM)/pocket.runtime-config.ts
	cd $(POCKETJS_SDK) && POCKETJS_FONT_REGULAR=$(ROOT)/../pocketshell/app/fonts/SarasaUiSC-Regular.ttf POCKETJS_FONT_BOLD=$(ROOT)/../pocketshell/app/fonts/SarasaUiSC-Bold.ttf POCKETJS_FONT_MONO=$(ROOT)/../pocketshell/app/fonts/SarasaUiSC-Regular.ttf $(HOME)/.bun/bin/bun tools/pocket.ts check --runtime-config programs/pocket-gamehub/pocket.runtime-config.ts --target rocknix-h700-kms --manifest apps/pocket-gamehub/pocket.json
	cd $(POCKETJS_SDK) && POCKETJS_FONT_REGULAR=$(ROOT)/../pocketshell/app/fonts/SarasaUiSC-Regular.ttf POCKETJS_FONT_BOLD=$(ROOT)/../pocketshell/app/fonts/SarasaUiSC-Bold.ttf POCKETJS_FONT_MONO=$(ROOT)/../pocketshell/app/fonts/SarasaUiSC-Regular.ttf $(HOME)/.bun/bin/bun tools/pocket.ts compile --runtime-config programs/pocket-gamehub/pocket.runtime-config.ts --target rocknix-h700-kms --manifest apps/pocket-gamehub/pocket.json --output $(GAMEHUB_POCKET_OUT)

pocket-check: pocket-build
	adb -s 5c0010894414c802512 push $(GAMEHUB_POCKET_OUT) /storage/pjs/gamehub.pocket
	adb -s 5c0010894414c802512 shell /storage/System/pocketjs/bin/pocket-linux-kms --package /storage/pjs/gamehub.pocket --check

build:
	cd $(BACKEND) && go build ./...
	cd $(FRONTEND) && npm run build


