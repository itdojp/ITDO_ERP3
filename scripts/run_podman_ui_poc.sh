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
SKIP_GRAPHQL_PREFLIGHT="${SKIP_GRAPHQL_PREFLIGHT:-false}"
DETACH=false
PODMAN_AUTO_HOST_FALLBACK="${PODMAN_AUTO_HOST_FALLBACK:-true}"
HOST_INTERNAL_ADDR="${HOST_INTERNAL_ADDR:-host.containers.internal}"
RABBITMQ_HOST_PORT="${RABBITMQ_HOST_PORT:-5672}"
REDIS_HOST_PORT="${REDIS_HOST_PORT:-6379}"
MINIO_HOST_PORT="${MINIO_HOST_PORT:-${MINIO_PORT:-9000}}"
LOKI_HOST_PORT="${LOKI_HOST_PORT:-3100}"

usage() {
  cat <<USAGE
Usage: ${0##*/} [options]

Options:
  --run-tests      Execute \`npm run test:e2e:live\` after the stack becomes healthy.
  --tests-only     Run live tests and skip launching the Next.js dev server (implies --run-tests).
  --with-minio     Export USE_MINIO=true before starting the stack.
  --no-build       Skip \`podman-compose --build\` and reuse existing images (or set PODMAN_BUILD=false).
  --build          Force \`podman-compose --build\` regardless of PODMAN_BUILD.
  --detach         Keep Podman/Next.js running in background (implies UI_HEADLESS=true).
  -h, --help       Show this help message.

Environment variables:
  PM_PORT, UI_PORT, PM_CONTAINER_PORT, UI_HEADLESS, USE_MINIO, PODMAN_BUILD,
  FORCE_PM_PORT (default 3001, Playwright live testsの強制ポート)
  PODMAN_AUTO_HOST_FALLBACK (default true), HOST_INTERNAL_ADDR (default host.containers.internal)
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
    --detach)
      DETACH=true
      UI_HEADLESS=true
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

wait_for_graphql() {
  if [[ "${SKIP_GRAPHQL_PREFLIGHT}" == "true" ]]; then
    return 0
  fi
  local port="$1"
  local attempts=0
  local max_attempts=20
  local payload='{"query":"query ComplianceProbe($filter: ComplianceInvoiceFilterInput) { complianceInvoices(filter: $filter) { meta { total } } }","variables":{"filter":{"page":1,"pageSize":1}}}'
  echo "[health] Waiting for GraphQL endpoint on http://localhost:${port}/graphql"
  while (( attempts < max_attempts )); do
    if curl -fsS -H 'Content-Type: application/json' -d "$payload" "http://localhost:${port}/graphql" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    attempts=$((attempts + 1))
  done
  echo "[health] ERROR: GraphQL endpoint not ready on port ${port}." >&2
  return 1
}

wait_for_pm_service() {
  local port="$1"
  local attempts=${PM_HEALTH_ATTEMPTS:-60}
  echo "[health] Waiting for pm-service on http://localhost:${port}"
  for ((i = 0; i < attempts; i++)); do
    if curl -fsS "http://localhost:${port}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# Switch service endpoints to host.containers.internal and restart the stack.
enable_host_internal_fallback() {
  local host="${HOST_INTERNAL_ADDR}"
  echo "[podman] Enabling host.containers.internal fallback (${host})"
  export AMQP_URL="amqp://guest:guest@${host}:${RABBITMQ_HOST_PORT}"
  export REDIS_URL="redis://${host}:${REDIS_HOST_PORT}"
  export MINIO_ENDPOINT="${host}"
  export MINIO_PUBLIC_ENDPOINT="${MINIO_PUBLIC_ENDPOINT:-${host}}"
  export MINIO_PUBLIC_PORT="${MINIO_PUBLIC_PORT:-${MINIO_HOST_PORT}}"
  export POC_LOKI_URL="http://localhost:${LOKI_HOST_PORT}"
  export PODMAN_HOST_FALLBACK_ACTIVE=true
}

should_attempt_host_fallback() {
  [[ ${PODMAN_AUTO_HOST_FALLBACK,,} == "true" && ${fallback_attempted} == false ]]
}

perform_host_fallback() {
  local reason="$1"
  echo "[health] ${reason}; retrying with host.containers.internal fallback"
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" down >/dev/null 2>&1) || true
  enable_host_internal_fallback
  fallback_attempted=true
  launch_stack
}

launch_stack() {
  echo "[podman] Starting backend PoC stack via podman-compose"
  echo "[podman] USE_MINIO=${USE_MINIO_FLAG}"
  local args=(-f "${COMPOSE_FILE}" up -d)
  case "${USE_BUILD,,}" in
    false|no|0)
      echo "[podman] Skipping image build step (PODMAN_BUILD=${USE_BUILD})"
      ;;
    *)
      args+=(--build)
      ;;
  esac
  (cd "${PROJECT_DIR}" && podman-compose "${args[@]}")
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

fallback_attempted=false

launch_stack

if ! wait_for_pm_service "$PM_HOST_PORT"; then
  if should_attempt_host_fallback; then
    perform_host_fallback "pm-service did not become healthy"
    if ! wait_for_pm_service "$PM_HOST_PORT"; then
      echo "[health] ERROR: pm-service did not become available even after host fallback." >&2
      exit 2
    fi
  else
    echo "[health] ERROR: pm-service did not become available after 60 seconds. Exiting." >&2
    exit 2
  fi
fi

if ! wait_for_graphql "$PM_HOST_PORT"; then
  if should_attempt_host_fallback; then
    perform_host_fallback "GraphQL preflight failed"
    if ! wait_for_pm_service "$PM_HOST_PORT" || ! wait_for_graphql "$PM_HOST_PORT"; then
      echo "[health] ERROR: pm-service/GraphQL not ready after host fallback." >&2
      exit 5
    fi
  else
    exit 5
  fi
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
  echo "[ui] Next.js dev server running (PID ${NEXT_DEV_PID})."
  if [ "${DETACH}" = 'true' ]; then
    printf '\n[ui] Detach mode enabled. Stack will continue running in the background.\n'
    printf '     Stop it manually with:\n'
    printf '       (cd %s && podman-compose -f %s down)\n' "${PROJECT_DIR}" "${COMPOSE_FILE}"
    printf '       pkill -f "next dev --hostname 0.0.0.0 --port %s"\n' "${UI_PORT_VALUE}"
    trap - EXIT
    exit 0
  fi
  echo "[ui] Press Ctrl+C to stop."
  wait ${NEXT_DEV_PID}
else
  env NEXT_PUBLIC_API_BASE="http://localhost:${PM_HOST_PORT}" \
      POC_API_BASE="http://localhost:${PM_HOST_PORT}" \
      npm run dev -- --hostname 0.0.0.0 --port "${UI_PORT_VALUE}"
fi
