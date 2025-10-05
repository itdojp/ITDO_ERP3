#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/poc/event-backbone/local/podman-compose.yml"
PROJECT_DIR="${ROOT_DIR}/poc/event-backbone/local"
UI_DIR="${ROOT_DIR}/ui-poc"
PM_HOST_PORT="${PM_PORT:-3001}"
PM_CONTAINER_PORT="${PM_CONTAINER_PORT:-3001}"
UI_PORT_VALUE="${UI_PORT:-4000}"
UI_HEADLESS="${UI_HEADLESS:-false}"
RUN_TESTS=false
TESTS_ONLY=false
USE_MINIO_FLAG="${USE_MINIO:-false}"
FORCE_PM=${FORCE_PM_PORT:-3001}
USE_BUILD="${PODMAN_BUILD:-true}"

usage() {
  cat <<USAGE
Usage: ${0##*/} [options]

Options:
  --run-tests      Execute \`npm run test:e2e:live\` after the stack becomes healthy.
  --tests-only     Run live tests and skip launching the Next.js dev server (implies --run-tests).
  --with-minio     Export USE_MINIO=true before starting the stack.
  --no-build       Skip \`podman-compose --build\` and reuse existing images (or set PODMAN_BUILD=false).
  --build          Force \`podman-compose --build\` regardless of PODMAN_BUILD.
  -h, --help       Show this help message.

Environment variables:
  PM_PORT, UI_PORT, PM_CONTAINER_PORT, UI_HEADLESS, USE_MINIO, PODMAN_BUILD,
  FORCE_PM_PORT (default 3001, Playwright live testsの強制ポート)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-tests)
      RUN_TESTS=true
      shift
      ;;
    --tests-only)
      RUN_TESTS=true
      TESTS_ONLY=true
      shift
      ;;
    --with-minio)
      USE_MINIO_FLAG=true
      shift
      ;;
    --no-build)
      USE_BUILD=false
      shift
      ;;
    --build)
      USE_BUILD=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

NEXT_DEV_PID=""

if ! command -v podman-compose >/dev/null 2>&1; then
  echo "podman-compose is required. Install it (e.g. 'pip install podman-compose') before running." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm command is required to run the Next.js dev server." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for health checks. Please install curl before running this script." >&2
  exit 1
fi

# Checks if the UI port is already taken and suggests alternatives.
check_ui_port() {
  local port="$UI_PORT_VALUE"
  local busy=0

  if command -v lsof >/dev/null 2>&1; then
    if lsof -PiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      busy=1
    fi
  elif command -v ss >/dev/null 2>&1; then
    if ss -ltn | grep -Eq "LISTEN[[:space:]]+.*:${port}\\b"; then
      busy=1
    fi
  else
    echo "[ui] WARNING: Could not determine if port ${port} is free (requires lsof or ss)." >&2
    return 0
  fi

  if [ "$busy" -eq 1 ]; then
    echo "[ui] ERROR: Port ${port} is already in use on this host." >&2
    echo "          Stop the process using the port or re-run with UI_PORT set to a free port." >&2
    exit 3
  fi
}

# Export variables for podman-compose so that host/container port values are respected.
export PM_PORT="${PM_HOST_PORT}"
export PM_CONTAINER_PORT
export USE_MINIO="${USE_MINIO_FLAG}"
export MINIO_PUBLIC_ENDPOINT="${MINIO_PUBLIC_ENDPOINT:-localhost}"
export MINIO_PUBLIC_PORT="${MINIO_PUBLIC_PORT:-9000}"

cleanup() {
  if [ -n "$NEXT_DEV_PID" ] && kill -0 "$NEXT_DEV_PID" 2>/dev/null; then
    kill "$NEXT_DEV_PID" 2>/dev/null || true
  fi
  printf '\n[cleanup] Stopping UI PoC stack...\n'
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" down >/dev/null 2>&1) || true
}

trap cleanup EXIT

cd "${PROJECT_DIR}"

echo "[podman] Starting backend PoC stack via podman-compose"
echo "[podman] USE_MINIO=${USE_MINIO_FLAG}"
compose_args=(-f "${COMPOSE_FILE}" up -d)
case "${USE_BUILD,,}" in
  false|no|0)
    echo "[podman] Skipping image build step (PODMAN_BUILD=${USE_BUILD})"
    ;;
  *)
    compose_args+=(--build)
    ;;
esac
podman-compose "${compose_args[@]}"

echo "[health] Waiting for pm-service on http://localhost:${PM_HOST_PORT}"
pm_service_up=false
for _ in {1..60}; do
  if curl -fsS "http://localhost:${PM_HOST_PORT}/health" >/dev/null 2>&1; then
    pm_service_up=true
    break
  fi
  sleep 1
done

if [ "$pm_service_up" = false ]; then
  echo "[health] ERROR: pm-service did not become available after 60 seconds. Exiting." >&2
  exit 2
fi

if [ "$RUN_TESTS" = true ]; then
  echo "[tests] Running Playwright live suite"
  if [ "$PM_HOST_PORT" != "$FORCE_PM" ]; then
    export PM_PORT="$FORCE_PM"
    export PM_CONTAINER_PORT="$FORCE_PM"
    echo "[tests] restarting stack on PM_PORT=${FORCE_PM} for live tests"
    (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" down >/dev/null 2>&1) || true
    (cd "${PROJECT_DIR}" && PM_PORT="$FORCE_PM" PM_CONTAINER_PORT="$FORCE_PM" USE_MINIO="$USE_MINIO_FLAG" podman-compose -f "${COMPOSE_FILE}" up -d --build)
    echo "[health] Waiting for pm-service on http://localhost:${FORCE_PM}"
    pm_service_up=false
    for _ in {1..60}; do
      if curl -fsS "http://localhost:${FORCE_PM}/health" >/dev/null 2>&1; then
        pm_service_up=true
        break
      fi
      sleep 1
    done
    if [ "$pm_service_up" = false ]; then
      echo "[health] ERROR: pm-service did not become available on ${FORCE_PM}." >&2
      exit 2
    fi
    PM_HOST_PORT="$FORCE_PM"
  fi
  if ! (cd "${UI_DIR}" && NEXT_PUBLIC_API_BASE="http://localhost:${FORCE_PM}" POC_API_BASE="http://localhost:${FORCE_PM}" PM_PORT="$FORCE_PM" npm run test:e2e:live); then
    echo "[tests] Playwright suite failed" >&2
    exit 4
  fi
  if [ "$TESTS_ONLY" = true ]; then
    echo "[tests] Completed. Stack will be torn down."
    exit 0
  fi
fi

check_ui_port

cd "${UI_DIR}"

echo "[ui] Starting Next.js dev server on port ${UI_PORT_VALUE}"
echo "      (API base: http://localhost:${PM_HOST_PORT})"
if [ "${UI_HEADLESS}" = 'true' ]; then
  LOG_FILE="${UI_DIR}/.next/dev.log"
  mkdir -p "${UI_DIR}/.next"
  echo "[ui] Launching Next.js in headless mode; logs -> ${LOG_FILE}"
  env NEXT_PUBLIC_API_BASE="http://localhost:${PM_HOST_PORT}" \
      POC_API_BASE="http://localhost:${PM_HOST_PORT}" \
      npm run dev -- --hostname 0.0.0.0 --port "${UI_PORT_VALUE}" > "${LOG_FILE}" 2>&1 &
  NEXT_DEV_PID=$!
  echo "[ui] Next.js dev server running (PID ${NEXT_DEV_PID}). Press Ctrl+C to stop."
  wait ${NEXT_DEV_PID}
else
  env NEXT_PUBLIC_API_BASE="http://localhost:${PM_HOST_PORT}" \
      POC_API_BASE="http://localhost:${PM_HOST_PORT}" \
      npm run dev -- --hostname 0.0.0.0 --port "${UI_PORT_VALUE}"
fi
