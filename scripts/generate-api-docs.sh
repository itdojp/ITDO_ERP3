#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
OPENAPI_SPEC="${REPO_ROOT}/openapi/projects-v1.yaml"
OPENAPI_OUT_DIR="${REPO_ROOT}/docs/api/openapi"
GRAPHQL_OUT_DIR="${REPO_ROOT}/docs/api/graphql"
SERVICE_DIR="${REPO_ROOT}/services/project-api"
API_PORT="${API_DOCS_PORT:-4300}"
API_LOG="$(mktemp -t api-docs-XXXX.log)"
API_ENTRY="${SERVICE_DIR}/dist/services/project-api/src/main.js"
API_PID=""

cleanup() {
  if [[ -n "${API_PID}" ]] && ps -p "${API_PID}" >/dev/null 2>&1; then
    kill "${API_PID}" >/dev/null 2>&1 || true
    wait "${API_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

echo "[api-docs] cleaning output directories"
rm -rf "${OPENAPI_OUT_DIR}" "${GRAPHQL_OUT_DIR}"
mkdir -p "${OPENAPI_OUT_DIR}"

echo "[api-docs] building GraphQL schema"
npm --prefix "${SERVICE_DIR}" run build >/dev/null

echo "[api-docs] generating OpenAPI documentation"
npx --yes @redocly/cli@1.15.0 build-docs "${OPENAPI_SPEC}" --output "${OPENAPI_OUT_DIR}/projects-v1.html" >/dev/null

echo "[api-docs] launching Project API on port ${API_PORT}"
export PORT="${API_PORT}"
export DATABASE_URL="${DATABASE_URL:-file:./docgen.db}"

if [[ ! -f "${API_ENTRY}" ]]; then
  echo "[api-docs] build output not found at ${API_ENTRY}" >&2
  exit 1
fi

node "${API_ENTRY}" >"${API_LOG}" 2>&1 &
API_PID=$!

for attempt in {1..30}; do
  if curl -s "http://127.0.0.1:${API_PORT}/graphql" >/dev/null 2>&1; then
    break
  fi
  if ! ps -p "${API_PID}" >/dev/null 2>&1; then
    cat "${API_LOG}" >&2 || true
    echo "[api-docs] Project API terminated unexpectedly" >&2
    exit 1
  fi
  sleep 1
  if [[ "${attempt}" -eq 30 ]]; then
    cat "${API_LOG}" >&2 || true
    echo "[api-docs] Project API did not become ready on port ${API_PORT}" >&2
    exit 1
  fi
done

echo "[api-docs] generating GraphQL documentation"
npx --yes @2fd/graphdoc@2.4.0 -e "http://127.0.0.1:${API_PORT}/graphql" -o "${GRAPHQL_OUT_DIR}" -f >/dev/null

echo "[api-docs] done"
rm -f "${API_LOG}"
