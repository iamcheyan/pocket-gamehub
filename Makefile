ROOT := $(CURDIR)
BACKEND := apps/pocket-gamehub/backend
FRONTEND := apps/pocket-gamehub/frontend

.PHONY: run test build
run:
	@tmp=$$(mktemp -d); \
	GAMEHUB_DB="$$tmp/gamehub.db" GAMEHUB_ADDR=127.0.0.1:18080 go run ./$(BACKEND) & backend_pid=$$!; \
	(cd $(FRONTEND) && npm run dev -- --host 127.0.0.1) & frontend_pid=$$!; \
	trap 'kill $$backend_pid $$frontend_pid 2>/dev/null || true; rm -rf "$$tmp"' EXIT INT TERM; \
	wait $$backend_pid $$frontend_pid

test:
	cd $(BACKEND) && go test ./...
	cd $(FRONTEND) && npm run i18n:check && npx tsc --noEmit && npm run build

build:
	cd $(BACKEND) && go build ./...
	cd $(FRONTEND) && npm run build