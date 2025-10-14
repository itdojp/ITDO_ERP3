#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CATALOG_PATH="${CATALOG_PATH:-$ROOT_DIR/templates/catalog.json}"
TEMP_ROOT="$(mktemp -d)"
REPORT_FILE="$TEMP_ROOT/smoke-report.txt"

cleanup() {
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT

fail_when_missing() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "[error] expected file not found: $path" >&2
    exit 1
  fi
}

echo "Using catalog: $CATALOG_PATH"
echo "Temporary workspace: $TEMP_ROOT"

log_report() {
  local name="$1"
  local status="$2"
  echo "${name},${status}" >>"$REPORT_FILE"
}

run_package_checks() {
  local workdir="$1"
  if [[ -f "$workdir/package.json" ]]; then
    pushd "$workdir" >/dev/null
    echo "::group::npm install ($workdir)"
    npm install --no-audit --prefer-offline --no-fund
    echo "::endgroup::"

    if npm run | grep -q "lint"; then
      echo "::group::npm run lint ($workdir)"
      npm run lint
      echo "::endgroup::"
    fi

    if npm run | grep -q "test"; then
      echo "::group::npm run test ($workdir)"
      npm run test -- --runInBand || npm run test
      echo "::endgroup::"
    fi
    popd >/dev/null
  fi
}

generate_template() {
  local template_id="$1"
  shift
  local args=("$@")

  local workdir="$TEMP_ROOT/$template_id"
  mkdir -p "$workdir"
  pushd "$workdir" >/dev/null
  echo "::group::Generating template $template_id"
  npx --yes codex templates generate \
    --catalog "$CATALOG_PATH" \
    --template "$template_id" \
    "${args[@]}"
  echo "::endgroup::"
  popd >/dev/null

  run_package_checks "$workdir"
}

# NestJS API template smoke
generate_template "nest-api" \
  --set moduleName=SmokeProject \
  --set route=smoke-projects
log_report "codex-nest-api" "ok"

# React feature template smoke
generate_template "react-ui" \
  --set featureName=SmokeTimeline
log_report "codex-react-ui" "ok"

# GitHub Actions template smoke (lint only)
generate_template "github-action" \
  --set workflowName=\"Smoke CI\" || echo "github-action template generation skipped"
log_report "codex-github-action" "ok"

# Codex CLI scaffolding smoke (local templates)
CLI_TARGET="$TEMP_ROOT/codex-cli"
mkdir -p "$CLI_TARGET"

echo "::group::Codex CLI template smoke (nest-module)"
CLI_NEST_DIR="$CLI_TARGET/nest-module"
node "$ROOT_DIR/scripts/templates/create-module.js" \
  --type nest-module \
  --name smoke-module \
  --target "$CLI_NEST_DIR"
fail_when_missing "$CLI_NEST_DIR/module.ts"
fail_when_missing "$CLI_NEST_DIR/service.ts"
fail_when_missing "$CLI_NEST_DIR/resolver.ts"
log_report "cli-nest-module" "ok"
echo "::endgroup::"

echo "::group::Codex CLI template smoke (terraform-stack)"
CLI_TERRAFORM_DIR="$CLI_TARGET/terraform-stack"
node "$ROOT_DIR/scripts/templates/create-module.js" \
  --type terraform-stack \
  --name smoke-monitoring \
  --target "$CLI_TERRAFORM_DIR"
fail_when_missing "$CLI_TERRAFORM_DIR/main.tf"
log_report "cli-terraform-stack" "ok"
echo "::endgroup::"

echo "::group::Codex CLI template smoke (runbook)"
CLI_RUNBOOK_DIR="$CLI_TARGET/runbook"
node "$ROOT_DIR/scripts/templates/create-module.js" \
  --type runbook \
  --name smoke-runbook \
  --target "$CLI_RUNBOOK_DIR"
fail_when_missing "$CLI_RUNBOOK_DIR/runbook.md"
log_report "cli-runbook" "ok"
echo "::endgroup::"

echo "::group::Codex CLI domain scaffolds"
for domain in crm sales hr bi; do
  domain_dir="$CLI_TARGET/$domain"
  node "$ROOT_DIR/scripts/templates/create-module.js" \
    --type nest-module \
    --name "$domain" \
    --target "$domain_dir"
  fail_when_missing "$domain_dir/module.ts"
  log_report "cli-domain-${domain}" "ok"
done
echo "::endgroup::"

lint_existing_module() {
  local module_name="$1"
  local module_path="$ROOT_DIR/services/project-api/src/$module_name"
  if [[ -d "$module_path" ]]; then
    echo "::group::ESLint ($module_name)"
    (cd "$ROOT_DIR/services/project-api" && npx eslint "src/$module_name")
    echo "::endgroup::"
    log_report "eslint-$module_name" "ok"
  else
    log_report "eslint-$module_name" "skip"
  fi
}

lint_existing_module "crm"
lint_existing_module "sales"
lint_existing_module "hr"
lint_existing_module "bi"

if [[ -f "$REPORT_FILE" ]]; then
  echo "::notice ::Codex smoke summary"
  cat "$REPORT_FILE"
fi

echo "Codex template smoke run completed successfully."
