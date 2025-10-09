#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/poc/event-backbone/local/podman-compose.yml"
PROJECT_DIR="${ROOT_DIR}/poc/event-backbone/local"
TELEMETRY_SEED_AUTO_RESET="${TELEMETRY_SEED_AUTO_RESET:-false}"
TELEMETRY_SEED_RESET_WITH_MINIO="${TELEMETRY_SEED_RESET_WITH_MINIO:-false}"
TELEMETRY_SEED_RESET_TIMEOUT="${TELEMETRY_SEED_RESET_TIMEOUT:-60}"
TELEMETRY_SEED_MAX_ATTEMPTS="${TELEMETRY_SEED_MAX_ATTEMPTS:-2}"
TELEMETRY_SEED_SETTLE_SECONDS="${TELEMETRY_SEED_SETTLE_SECONDS:-2}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

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

notify_slack() {
  local status="$1"
  local message="$2"
  if [[ -z "${SLACK_WEBHOOK_URL}" ]]; then
    return
  fi
  local color="#36a64f"
  local emoji=":white_check_mark:"
  case "$status" in
    warning)
      color="#f59e0b"
      emoji=":warning:"
      ;;
    failure)
      color="#d73a4a"
      emoji=":x:"
      ;;
  esac
  local payload
  payload=$(cat <<JSON
{
  "attachments": [
    {
      "color": "${color}",
      "title": "PoC podman status (${status})",
      "text": "${emoji} ${message}",
      "mrkdwn_in": ["text"]
    }
  ]
}
JSON
)
  if ! curl -s -X POST -H 'Content-Type: application/json' -d "${payload}" "${SLACK_WEBHOOK_URL}" >/dev/null 2>&1; then
    echo "[slack] warning: failed to send notification (status=${status})" >&2
  fi
}

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
  notify_slack "failure" "podman_status telemetry seed skipped (python3 not available)"
else
  telemetry_attempts=1
  if [[ ${TELEMETRY_SEED_AUTO_RESET,,} == "true" ]]; then
    telemetry_attempts="${TELEMETRY_SEED_MAX_ATTEMPTS}"
    if ! [[ "${telemetry_attempts}" =~ ^[0-9]+$ ]] || (( telemetry_attempts < 2 )); then
      telemetry_attempts=2
    fi
  fi
  telemetry_status=1
  telemetry_message=""
  fallback_used=false
  slack_fallback_sent=false
  attempt=0
  while (( attempt < telemetry_attempts )); do
    attempt=$((attempt + 1))
    if ! response=$(curl -fsS "${TELEMETRY_ENDPOINT}" 2>/dev/null); then
      telemetry_message="failed to fetch telemetry payload"
  else
      export TELEMETRY_MIN_SEEDED
      export TELEMETRY_PAYLOAD="${response}"
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
      telemetry_status=$?
      unset TELEMETRY_PAYLOAD
      set -e
      telemetry_message=$(printf '%s' "${python_output}" | tr -d '\n')
      if [ "${telemetry_status}" -eq 0 ]; then
        break
      fi
    fi

    if (( attempt < telemetry_attempts )); then
      fallback_used=true
      echo "[telemetry] seed verification failed (attempt ${attempt}); resetting state" >&2
      if [[ "${slack_fallback_sent}" != "true" ]]; then
        notify_slack "warning" "podman_status telemetry seed fallback triggered (attempt ${attempt})"
        slack_fallback_sent=true
      fi
      reset_args=()
      if [[ ${TELEMETRY_SEED_RESET_WITH_MINIO,,} == "true" ]]; then
        reset_args+=(--with-minio)
      fi
      reset_pm_state_output=$(mktemp)
      if ! "${ROOT_DIR}/scripts/reset_pm_state.sh" "${reset_args[@]}" >"${reset_pm_state_output}" 2>&1; then
        echo "[telemetry] reset_pm_state.sh execution failed" >&2
        echo "[telemetry] Output:" >&2
        cat "${reset_pm_state_output}" >&2
        rm -f "${reset_pm_state_output}"
        break
      fi
      rm -f "${reset_pm_state_output}"
      echo "[telemetry] restarting pm-service for telemetry reseed" >&2
      if ! (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" restart pm-service >/dev/null 2>&1); then
        echo "[telemetry] pm-service restart failed" >&2
        break
      fi
      echo "[telemetry] waiting for pm-service health..." >&2
      healthy=false
      for wait_attempt in $(seq 1 "${TELEMETRY_SEED_RESET_TIMEOUT}"); do
        if curl -fsS "http://localhost:${PM_HOST_PORT}/health" >/dev/null 2>&1; then
          healthy=true
          break
        fi
        sleep 1
      done
      if [[ "${healthy}" != "true" ]]; then
        echo "[telemetry] pm-service did not recover within ${TELEMETRY_SEED_RESET_TIMEOUT}s" >&2
        break
      fi
      sleep "${TELEMETRY_SEED_SETTLE_SECONDS}"
      continue
    fi
  done

  if [ "${telemetry_status}" -eq 0 ]; then
    if [[ "${fallback_used}" == "true" ]]; then
      echo "ok - ${telemetry_message} (after auto reset)"
      notify_slack "success" "podman_status telemetry seed verified after reset (${telemetry_message})"
    else
      echo "ok - ${telemetry_message}"
      notify_slack "success" "podman_status telemetry seed ok (${telemetry_message})"
    fi
  else
    if [ -n "${telemetry_message}" ]; then
      echo "error - ${telemetry_message}"
      notify_slack "failure" "podman_status telemetry seed failed: ${telemetry_message}"
    else
      echo "error - telemetry seed verification failed"
      notify_slack "failure" "podman_status telemetry seed verification failed"
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
