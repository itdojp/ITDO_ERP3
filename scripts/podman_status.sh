#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/poc/event-backbone/local/podman-compose.yml"
PROJECT_DIR="${ROOT_DIR}/poc/event-backbone/local"
source "${ROOT_DIR}/scripts/lib/slack.sh"
TELEMETRY_SEED_AUTO_RESET="${TELEMETRY_SEED_AUTO_RESET:-false}"
TELEMETRY_SEED_RESET_WITH_MINIO="${TELEMETRY_SEED_RESET_WITH_MINIO:-false}"
TELEMETRY_SEED_RESET_TIMEOUT="${TELEMETRY_SEED_RESET_TIMEOUT:-60}"
TELEMETRY_SEED_MAX_ATTEMPTS="${TELEMETRY_SEED_MAX_ATTEMPTS:-2}"
TELEMETRY_SEED_SETTLE_SECONDS="${TELEMETRY_SEED_SETTLE_SECONDS:-2}"
PM_SERVICE_SEED_RETRY_ATTEMPTS="${TELEMETRY_SEED_RETRY_ATTEMPTS:-}"
PM_SERVICE_SEED_RETRY_DELAY_MS="${TELEMETRY_SEED_RETRY_DELAY_MS:-}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
PODMAN_STATUS_SLACK_NOTIFY_SUCCESS="${PODMAN_STATUS_SLACK_NOTIFY_SUCCESS:-false}"
PODMAN_STATUS_SUMMARY_FILE="${PODMAN_STATUS_SUMMARY_FILE:-}"

SERVICE_STATUS="ok"
TELEMETRY_STATUS="skipped"
TELEMETRY_MESSAGE=""
TELEMETRY_ATTEMPTS=0

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
  if [[ "$status" == "success" && ${PODMAN_STATUS_SLACK_NOTIFY_SUCCESS,,} != "true" ]]; then
    return
  fi

  slack_send "$status" "PoC podman status ($status)" "$message"
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
    SERVICE_STATUS="error"
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
  TELEMETRY_STATUS="skipped"
  TELEMETRY_MESSAGE="python3 not available"
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
    TELEMETRY_STATUS="ok"
    TELEMETRY_MESSAGE="${telemetry_message}"
    TELEMETRY_ATTEMPTS=${attempt}
    telemetry_context="attempt=${attempt}, reset=${fallback_used}"
    if [[ -n "${PM_SERVICE_SEED_RETRY_ATTEMPTS}" ]]; then
      telemetry_context+="; pm-service-retries=${PM_SERVICE_SEED_RETRY_ATTEMPTS}"
    fi
    if [[ -n "${PM_SERVICE_SEED_RETRY_DELAY_MS}" ]]; then
      telemetry_context+="; pm-service-delay-ms=${PM_SERVICE_SEED_RETRY_DELAY_MS}"
    fi
    if [[ "${fallback_used}" == "true" ]]; then
      echo "ok - ${telemetry_message} (after auto reset, ${telemetry_context})"
      notify_slack "success" "podman_status telemetry seed verified after reset (${telemetry_message}; ${telemetry_context})"
    else
      echo "ok - ${telemetry_message} (${telemetry_context})"
      notify_slack "success" "podman_status telemetry seed ok (${telemetry_message}; ${telemetry_context})"
    fi
  else
    TELEMETRY_STATUS="error"
    TELEMETRY_ATTEMPTS=${attempt}
    if [ -n "${telemetry_message}" ]; then
      echo "error - ${telemetry_message} (attempt=${attempt})"
      notify_slack "failure" "podman_status telemetry seed failed after ${attempt} attempt(s): ${telemetry_message}"
      TELEMETRY_MESSAGE="${telemetry_message}"
    else
      echo "error - telemetry seed verification failed (attempt=${attempt})"
      notify_slack "failure" "podman_status telemetry seed verification failed after ${attempt} attempt(s)"
      TELEMETRY_MESSAGE="telemetry seed verification failed"
    fi
  fi
fi


if [[ -n "${PODMAN_STATUS_SUMMARY_FILE}" ]]; then
  mkdir -p "$(dirname "${PODMAN_STATUS_SUMMARY_FILE}")"
  timestamp=$(date -Is)
  fallback_value=${fallback_used:-false}
  if command -v python3 >/dev/null 2>&1; then
    SUMMARY_FILE="${PODMAN_STATUS_SUMMARY_FILE}" \
    SUMMARY_TIMESTAMP="${timestamp}" \
    SUMMARY_PM_PORT="${PM_HOST_PORT}" \
    SUMMARY_UI_PORT="${UI_PORT_VALUE}" \
    SUMMARY_SERVICE_STATUS="${SERVICE_STATUS}" \
    SUMMARY_TELEMETRY_STATUS="${TELEMETRY_STATUS}" \
    SUMMARY_TELEMETRY_MESSAGE="${TELEMETRY_MESSAGE}" \
    SUMMARY_TELEMETRY_ATTEMPTS="${TELEMETRY_ATTEMPTS}" \
    SUMMARY_TELEMETRY_RESET="${fallback_value}" \
    python3 <<'PY'
import json
import os

data = {
    "timestamp": os.environ["SUMMARY_TIMESTAMP"],
    "pm_port": os.environ["SUMMARY_PM_PORT"],
    "ui_port": os.environ["SUMMARY_UI_PORT"],
    "service_health": os.environ["SUMMARY_SERVICE_STATUS"],
    "telemetry_status": os.environ["SUMMARY_TELEMETRY_STATUS"],
    "telemetry_message": os.environ.get("SUMMARY_TELEMETRY_MESSAGE", ""),
    "telemetry_attempts": int(os.environ.get("SUMMARY_TELEMETRY_ATTEMPTS", 0) or 0),
    "telemetry_reset_used": os.environ.get("SUMMARY_TELEMETRY_RESET", "false").lower() == "true",
}
with open(os.environ["SUMMARY_FILE"], "w", encoding="utf-8") as fh:
    json.dump(data, fh, ensure_ascii=False, indent=2)
PY
    echo "[summary] wrote ${PODMAN_STATUS_SUMMARY_FILE}" >&2
  else
    echo "[summary] python3 not available; skipping summary file" >&2
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
