#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/poc/event-backbone/local/podman-compose.yml"
PROJECT_DIR="${ROOT_DIR}/poc/event-backbone/local"

print_section() {
  local title=$1
  echo
  echo "== ${title} =="
}

print_section "Podman containers"
(
  cd "${PROJECT_DIR}"
  podman-compose -f "${COMPOSE_FILE}" ps
)

print_section "Service health"
PM_HOST_PORT=${PM_PORT:-3001}
for endpoint in \
  "http://localhost:${PM_HOST_PORT}/health" \
  "http://localhost:${PM_HOST_PORT}/metrics/summary"; do
  printf "%-45s : " "${endpoint}"
  if curl -fsS -o /dev/null "${endpoint}"; then
    echo "ok"
  else
    echo "error"
  fi
  sleep 0.1
 done

print_section "Telemetry seed verification"
TELEMETRY_ENDPOINT="${TELEMETRY_ENDPOINT:-http://localhost:${PM_HOST_PORT}/api/v1/telemetry/ui?limit=50}"
TELEMETRY_MIN_SEEDED=${TELEMETRY_MIN_SEEDED:-5}
printf "%-45s : " "${TELEMETRY_ENDPOINT}"
if ! command -v python3 >/dev/null 2>&1; then
  echo "skipped (python3 not available)"
elif ! response=$(curl -fsS "${TELEMETRY_ENDPOINT}" 2>/dev/null); then
  echo "error (failed to fetch telemetry payload)"
else
  export TELEMETRY_PAYLOAD="${response}"
  export TELEMETRY_MIN_SEEDED
  set +e
  python_output=$(python3 <<'PY2'
import json
import os
import sys

payload_raw = os.environ.get("TELEMETRY_PAYLOAD", "")
expected_raw = os.environ.get("TELEMETRY_MIN_SEEDED", "0")
try:
    expected = max(0, int(expected_raw))
except Exception:
    expected = 0

try:
    payload = json.loads(payload_raw)
except Exception as exc:
    print(f"JSON decode error: {exc}")
    sys.exit(2)

items = payload.get("items")
if not isinstance(items, list):
    print("payload missing items list")
    sys.exit(2)

seeded = sum(
    1
    for item in items
    if isinstance(item, dict)
    and isinstance(item.get("detail"), dict)
    and item["detail"].get("seeded") is True
)

print(f"seeded events: {seeded} (expected >= {expected})")
sys.exit(0 if seeded >= expected else 1)
PY2
  )
  python_status=$?
  unset TELEMETRY_PAYLOAD
  set -e
  clean_output=$(printf '%s' "${python_output}" | tr -d '\n')
  if [ "${python_status}" -eq 0 ]; then
    echo "ok - ${clean_output}"
  else
    if [ -n "${clean_output}" ]; then
      echo "error - ${clean_output}"
    else
      echo "error - telemetry seed verification failed"
    fi
  fi
fi



print_section "UI availability"
UI_PORT_VALUE=${UI_PORT:-4000}
printf "http://localhost:%s                        : " "${UI_PORT_VALUE}"
if curl -fsS -o /dev/null "http://localhost:${UI_PORT_VALUE}"; then
  echo "ok"
else
  echo "error"
fi

print_section "Processes"
ps -eo pid,cmd | grep -E "podman|run_podman_ui_poc|next dev" | grep -v grep || true
