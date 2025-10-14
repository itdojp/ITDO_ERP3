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
	@echo "  make share-projects          # Generate Projects Slack share template (ARGS="..." to pass options)"
	@echo "  make share-projects-sample   # Output sample Projects Slack share template"
	@echo "  make ledger-plan             # Run terraform plan for electronic-ledger stack (skip creds)"

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

.PHONY: share-projects
share-projects:
	cd ui-poc && npm run share:projects -- $(ARGS)

.PHONY: share-projects-sample
share-projects-sample:
	cd ui-poc && npm run --silent share:projects:sample

.PHONY: ledger-plan
ledger-plan:
	@cd iac/stacks/electronic-ledger && \
	tmp=$$(mktemp -d) && \
	curl -fsSLo $$tmp/terraform.zip https://releases.hashicorp.com/terraform/1.9.0/terraform_1.9.0_linux_amd64.zip && \
	unzip -q $$tmp/terraform.zip -d $$tmp && \
	"$$tmp/terraform" init -backend=false >/dev/null && \
	TF_VAR_aws_region=ap-northeast-1 \
	TF_VAR_environment=ci \
	TF_VAR_skip_credentials_validation=true \
	AWS_ACCESS_KEY_ID=dummy AWS_SECRET_ACCESS_KEY=dummy AWS_DEFAULT_REGION=ap-northeast-1 \
	"$$tmp/terraform" plan -input=false -lock=false
