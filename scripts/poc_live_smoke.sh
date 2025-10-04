#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/poc/event-backbone/local/podman-compose.yml"
PROJECT_DIR="${ROOT_DIR}/poc/event-backbone/local"
UI_DIR="${ROOT_DIR}/ui-poc"
PM_PORT="${PM_PORT:-3001}"
POLL_INTERVAL="${POLL_INTERVAL:-1}"
TIMEOUT="${TIMEOUT_SECONDS:-60}"
LOG_DIR="${LOG_DIR:-${ROOT_DIR}/logs/poc-smoke}"
LOOP=false
LOOP_INTERVAL=600
START_TIME=$(date +%s)
LAST_LOG_FILE=""

usage() {
  cat <<USAGE
Usage: ${0##*/} [--loop] [--interval seconds]

Options:
  --loop             Run tests continuously. The stack is restarted before each run.
  --interval SEC     Sleep seconds between loop iterations (default: 600).
  -h, --help         Show this help message.

Environment variables:
  PM_PORT            Host port for pm-service (default: 3001)
  TIMEOUT_SECONDS    Maximum wait for pm-service health (default: 60)
  POLL_INTERVAL      Poll interval while waiting for health (default: 1)
  LOG_DIR            Directory to store collected logs (default: logs/poc-smoke)
  SLACK_WEBHOOK_URL  Optional Slack incoming webhook URL for notifications
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --loop)
      LOOP=true
      shift
      ;;
    --interval)
      if [[ $# -lt 2 ]]; then
        echo "[error] --interval requires a value" >&2
        exit 1
      fi
      LOOP_INTERVAL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[error] Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

mkdir -p "${LOG_DIR}"

if ! command -v podman-compose >/dev/null 2>&1; then
  echo "[error] podman-compose is required" >&2
  exit 1
fi

collect_logs() {
  local reason="$1"
  local timestamp
  timestamp=$(date +%Y%m%d_%H%M%S)
  LAST_LOG_FILE="${LOG_DIR}/podman_logs_${reason}_${timestamp}.log"
  echo "[logs] collecting podman-compose logs -> ${LAST_LOG_FILE}"
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" logs --tail=400) >"${LAST_LOG_FILE}" 2>&1 || true
}

notify_slack() {
  if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
    return
  fi
  local status="$1"
  local message="$2"
  local duration=$(( $(date +%s) - START_TIME ))
  local color="#36a64f"
  local resultEmoji=":white_check_mark:"
  if [[ "$status" != "success" ]]; then
    color="#d73a4a"
    resultEmoji=":x:"
  fi
  local logInfo=""
  if [[ -n "$LAST_LOG_FILE" ]]; then
    logInfo="Logs: $LAST_LOG_FILE"
  fi
  local payload=$(cat <<JSON
{
  "attachments": [
    {
      "color": "${color}",
      "title": "PoC Live Smoke (${status})",
      "text": "${resultEmoji} ${message}\nDuration: ${duration}s\n${logInfo}",
      "mrkdwn_in": ["text"]
    }
  ]
}
JSON
)
  curl -s -X POST -H 'Content-Type: application/json' -d "$payload" "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
}

cleanup() {
  echo "[cleanup] stopping PoC stack"
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" down >/dev/null 2>&1) || true
}

trap cleanup EXIT

start_stack() {
  echo "[stack] restarting PoC stack"
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" down >/dev/null 2>&1) || true
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" up -d --build)
}

wait_for_health() {
  local elapsed=0
  echo "[health] waiting for pm-service on http://localhost:${PM_PORT}"
  until curl -fsS "http://localhost:${PM_PORT}/health" >/dev/null 2>&1; do
    sleep "${POLL_INTERVAL}"
    elapsed=$((elapsed + POLL_INTERVAL))
    if (( elapsed >= TIMEOUT )); then
      echo "[health] ERROR: pm-service did not become healthy within ${TIMEOUT}s" >&2
      collect_logs "health"
      notify_slack "failure" "pm-service failed health check"
      return 1
    fi
  done
  echo "[health] pm-service is ready"
  return 0
}

run_tests() {
  echo "[tests] running Playwright live suite"
  if ! (cd "${UI_DIR}" && NEXT_PUBLIC_API_BASE="http://localhost:${PM_PORT}" POC_API_BASE="http://localhost:${PM_PORT}" npm run test:e2e:live); then
    echo "[tests] Playwright suite failed" >&2
    collect_logs "tests"
    notify_slack "failure" "Playwright live suite failed"
    return 1
  fi
  return 0
}

STATUS="success"
LOOP_COUNT=0

while true; do
  LOOP_COUNT=$((LOOP_COUNT + 1))
  start_stack
  if ! wait_for_health; then
    STATUS="failure"
    break
  fi
  if ! run_tests; then
    STATUS="failure"
    break
  fi
  if [[ "${LOOP}" != "true" ]]; then
    break
  fi
  echo "[loop] sleeping ${LOOP_INTERVAL}s before next run"
  sleep "${LOOP_INTERVAL}"
  echo
  echo "[loop] restarting cycle"

done

if [[ "$STATUS" == "success" ]]; then
  notify_slack "success" "Live smoke completed successfully (${LOOP_COUNT} run(s))"
fi
