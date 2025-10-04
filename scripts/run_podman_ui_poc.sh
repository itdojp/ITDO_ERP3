#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/poc/event-backbone/local/podman-compose.yml"
PROJECT_DIR="${ROOT_DIR}/poc/event-backbone/local"
UI_DIR="${ROOT_DIR}/ui-poc"
PM_HOST_PORT="${PM_PORT:-3001}"
PM_CONTAINER_PORT="${PM_CONTAINER_PORT:-3001}"
UI_PORT_VALUE="${UI_PORT:-4000}"

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
    if ss -ltn | grep -Eq "LISTEN\\s+.*:${port}\\b"; then
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

cleanup() {
  printf '\n[cleanup] Stopping UI PoC stack...\n'
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" down >/dev/null 2>&1) || true
}

trap cleanup EXIT

cd "${PROJECT_DIR}"

echo "[podman] Starting backend PoC stack via podman-compose"
podman-compose -f "${COMPOSE_FILE}" up -d --build

echo "[health] Waiting for pm-service on http://localhost:${PM_HOST_PORT}"
pm_service_up=false
for _ in {1..40}; do
  if curl -fsS "http://localhost:${PM_HOST_PORT}/health" >/dev/null 2>&1; then
    pm_service_up=true
    break
  fi
  sleep 1
done

if [ "$pm_service_up" = false ]; then
  echo "[health] ERROR: pm-service did not become available after 40 seconds. Exiting." >&2
  exit 2
fi

check_ui_port

cd "${UI_DIR}"

echo "[ui] Starting Next.js dev server on port ${UI_PORT_VALUE}"
echo "      (API base: http://localhost:${PM_HOST_PORT})"
NEXT_PUBLIC_API_BASE="http://localhost:${PM_HOST_PORT}" \
POC_API_BASE="http://localhost:${PM_HOST_PORT}" \
npm run dev -- --hostname 0.0.0.0 --port "${UI_PORT_VALUE}"
