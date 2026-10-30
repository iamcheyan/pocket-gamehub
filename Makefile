ROOT := $(CURDIR)
BACKEND := apps/pocket-gamehub/backend
FRONTEND := apps/pocket-gamehub/frontend
TESTS := apps/pocket-gamehub/tests

# Browser tests need a Chromium and puppeteer-core. Override if they live
# elsewhere: make test-ui CHROME_BIN=... PUPPETEER_CORE=...
CHROME_BIN ?= /run/current-system/sw/bin/chromium
PUPPETEER_CORE ?= /home/tetsuya/.bun/install/global/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js

.PHONY: run test test-backend test-frontend test-integration test-ui build

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

# Requires the app to be running (make run in another terminal): drives the
# real UI at 320x240 to prove browse -> detail -> favourite -> launch.
test-ui:
	CHROME_BIN=$(CHROME_BIN) PUPPETEER_CORE=$(PUPPETEER_CORE) node $(TESTS)/ui-320x240-flow.mjs

build:
	cd $(BACKEND) && go build ./...
	cd $(FRONTEND) && npm run build
