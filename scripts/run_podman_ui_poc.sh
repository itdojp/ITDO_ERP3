#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/poc/event-backbone/local/podman-compose.yml"
PROJECT_DIR="${ROOT_DIR}/poc/event-backbone/local"
UI_DIR="${ROOT_DIR}/ui-poc"
PM_PORT_VALUE="${PM_PORT:-3001}"
UI_PORT_VALUE="${UI_PORT:-4000}"

if ! command -v podman-compose >/dev/null 2>&1; then
  echo "podman-compose is required. Install it (e.g. 'pip install podman-compose') before running." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm command is required to run the Next.js dev server." >&2
  exit 1
fi

cleanup() {
  echo "\n[cleanup] Stopping UI PoC stack..."
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" down >/dev/null 2>&1) || true
}

trap cleanup EXIT

cd "${PROJECT_DIR}"

echo "[podman] Starting backend PoC stack via podman-compose"
podman-compose -f "${COMPOSE_FILE}" up -d --build

echo "[health] Waiting for pm-service on http://localhost:${PM_PORT_VALUE}"
for _ in {1..40}; do
  if curl -fsS "http://localhost:${PM_PORT_VALUE}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

cd "${UI_DIR}"

echo "[ui] Starting Next.js dev server on port ${UI_PORT_VALUE}"
echo "      (API base: http://localhost:${PM_PORT_VALUE})"
NEXT_PUBLIC_API_BASE="http://localhost:${PM_PORT_VALUE}" \
POC_API_BASE="http://localhost:${PM_PORT_VALUE}" \
npm run dev -- --port "${UI_PORT_VALUE}"
