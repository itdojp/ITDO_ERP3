#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/poc/event-backbone/local/podman-compose.yml"
PROJECT_DIR="${ROOT_DIR}/poc/event-backbone/local"
PM_PORT_VALUE="${PM_PORT:-3001}"

if ! command -v podman-compose >/dev/null 2>&1; then
  echo "podman-compose is required. Install it (e.g. 'pip install podman-compose') before running." >&2
  exit 1
fi

cd "${PROJECT_DIR}"

cleanup() {
  podman-compose -f "${COMPOSE_FILE}" down >/dev/null 2>&1 || true
}

trap cleanup EXIT

podman-compose -f "${COMPOSE_FILE}" up -d --build

echo "Waiting for pm-service health endpoint..."
for _ in {1..30}; do
  if curl -fsS "http://localhost:${PM_PORT_VALUE}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -sS -X POST \
  -H 'Content-Type: application/json' \
  "http://localhost:${PM_PORT_VALUE}/timesheets/approve" \
  -d '{"timesheetId":"TS-PODMAN","hours":8}' >/dev/null || true

sleep 10

echo "--- Producer logs (tail) ---"
podman logs --tail 20 local_producer_1 || true

echo "--- Consumer logs (tail) ---"
podman logs --tail 40 local_consumer_1 || true

echo "(Use Ctrl+C to stop streaming; stack will auto-shutdown)"
podman logs -f local_consumer_1 || true
