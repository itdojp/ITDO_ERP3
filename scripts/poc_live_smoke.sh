#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/poc/event-backbone/local/podman-compose.yml"
PROJECT_DIR="${ROOT_DIR}/poc/event-backbone/local"
UI_DIR="${ROOT_DIR}/ui-poc"
PM_PORT="${PM_PORT:-3001}"
POLL_INTERVAL="${POLL_INTERVAL:-1}"
TIMEOUT="${TIMEOUT_SECONDS:-60}"
LOOP=false
LOOP_INTERVAL=600

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

if ! command -v podman-compose >/dev/null 2>&1; then
  echo "[error] podman-compose is required" >&2
  exit 1
fi

cleanup() {
  echo "[cleanup] stopping PoC stack"
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" down >/dev/null 2>&1) || true
}

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
      return 1
    fi
  done
  echo "[health] pm-service is ready"
}

run_tests() {
  echo "[tests] running Playwright live suite"
  (cd "${UI_DIR}" && NEXT_PUBLIC_API_BASE="http://localhost:${PM_PORT}" POC_API_BASE="http://localhost:${PM_PORT}" npm run test:e2e:live)
}

trap cleanup EXIT

while true; do
  start_stack
  if ! wait_for_health; then
    echo "[tests] Skipping tests due to pm-service failure" >&2
    exit 1
  fi
  if ! run_tests; then
    echo "[tests] Playwright suite failed" >&2
    exit 1
  fi
  if [[ "${LOOP}" != "true" ]]; then
    break
  fi
  echo "[loop] sleeping ${LOOP_INTERVAL}s before next run"
  sleep "${LOOP_INTERVAL}"
  echo
  echo "[loop] restarting cycle"

done
