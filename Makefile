PM_PORT ?= 3001
UI_PORT ?= 4000
UI_HEADLESS ?= false
FORCE_PM_PORT ?= 3001

default: help

.PHONY: help
help:
	@echo "Available targets:"
	@echo "  make live-tests              # Run Podman stack with current settings and execute Playwright live tests"
	@echo "  make live-tests-minio        # Run live tests with MinIO enabled (USE_MINIO/E2E_REQUIRE_MINIO)"
	@echo "  make lint                    # Run UI lint"
	@echo "  make test-e2e                # Run UI Playwright E2E tests"

.PHONY: live-tests
live-tests:
	FORCE_PM_PORT=$(FORCE_PM_PORT) PM_PORT=$(PM_PORT) UI_PORT=$(UI_PORT) UI_HEADLESS=$(UI_HEADLESS) scripts/run_podman_ui_poc.sh --tests-only

.PHONY: live-tests-minio
live-tests-minio:
	FORCE_PM_PORT=$(FORCE_PM_PORT) USE_MINIO=true E2E_REQUIRE_MINIO=true PM_PORT=$(PM_PORT) UI_PORT=$(UI_PORT) UI_HEADLESS=$(UI_HEADLESS) scripts/run_podman_ui_poc.sh --tests-only

.PHONY: lint
lint:
	cd ui-poc && npm run lint

.PHONY: test-e2e
test-e2e:
	cd ui-poc && npm run test:e2e
