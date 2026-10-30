ROOT := $(CURDIR)
BACKEND := apps/pocket-gamehub/backend
FRONTEND := apps/pocket-gamehub/frontend
TESTS := apps/pocket-gamehub/tests

.PHONY: run test test-backend test-frontend test-integration build

# One command for the whole app: gamed + Vite dev server (proxying /api).
run:
	@tmp=$$(mktemp -d); \
	GAMEHUB_DB="$$tmp/gamehub.db" GAMEHUB_ADDR=127.0.0.1:18470 go run ./$(BACKEND) & backend_pid=$$!; \
	(cd $(FRONTEND) && GAMEHUB_API_TARGET=http://127.0.0.1:18470 npm run dev -- --host 127.0.0.1 --port 18480) & frontend_pid=$$!; \
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

build:
	cd $(BACKEND) && go build ./...
	cd $(FRONTEND) && npm run build
