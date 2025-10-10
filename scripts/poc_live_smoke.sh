#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/poc/event-backbone/local/podman-compose.yml"
PROJECT_DIR="${ROOT_DIR}/poc/event-backbone/local"
UI_DIR="${ROOT_DIR}/ui-poc"
source "${ROOT_DIR}/scripts/lib/slack.sh"
PM_PORT="${PM_PORT:-3001}"
MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_TIMEOUT="${MINIO_TIMEOUT_SECONDS:-60}"
POLL_INTERVAL="${POLL_INTERVAL:-1}"
TIMEOUT="${TIMEOUT_SECONDS:-60}"
LOG_DIR="${LOG_DIR:-${ROOT_DIR}/logs/poc-smoke}"
USE_MINIO="${USE_MINIO:-true}"
RETRY_LIMIT="${RETRY_LIMIT:-1}"
RETRY_DELAY="${RETRY_DELAY_SECONDS:-15}"
LOOP=false
LOOP_INTERVAL=600
START_TIME=$(date +%s)
LAST_LOG_FILE=""
LAST_LOG_FILE_MINIO=""
LAST_LOG_FILE_PM=""
ALLOW_FAILURE_NOTIFY=1
RUN_METRICS_STRESS="${RUN_METRICS_STRESS:-false}"
METRICS_STRESS_CLIENTS="${METRICS_STREAM_CLIENTS:-20}"
METRICS_STREAM_ITERATIONS="${METRICS_STREAM_ITERATIONS:-1}"
CHECK_GRAFANA_ALERTS="${CHECK_GRAFANA_ALERTS:-true}"
GRAFANA_HOST="${GRAFANA_HOST:-localhost}"
GRAFANA_PORT="${GRAFANA_PORT:-3000}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-admin}"
CHECK_GRAFANA_DASHBOARDS="${CHECK_GRAFANA_DASHBOARDS:-true}"
EXPECTED_GRAFANA_DASHBOARDS="${EXPECTED_GRAFANA_DASHBOARDS:-PoC Metrics Overview,PoC Logs Explorer,PoC UI Telemetry}"
EXPECTED_GRAFANA_DASHBOARD_UIDS="${EXPECTED_GRAFANA_DASHBOARD_UIDS:-poc-metrics,poc-logs,poc-telemetry}"
CHECK_GRAFANA_MANIFEST="${CHECK_GRAFANA_MANIFEST:-true}"
GRAFANA_MANIFEST_SCRIPT="${GRAFANA_MANIFEST_SCRIPT:-${ROOT_DIR}/scripts/check_grafana_manifest.py}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
RABBITMQ_PORT="${RABBITMQ_PORT:-5672}"
RABBITMQ_MANAGEMENT_PORT="${RABBITMQ_MANAGEMENT_PORT:-15672}"
RABBITMQ_USER="${RABBITMQ_USER:-${RABBITMQ_DEFAULT_USER:-guest}}"
RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD:-${RABBITMQ_DEFAULT_PASS:-guest}}"
RABBITMQ_TIMEOUT_SECONDS="${RABBITMQ_TIMEOUT_SECONDS:-90}"
RABBITMQ_HOST_PORT="${RABBITMQ_HOST_PORT:-${RABBITMQ_PORT:-5672}}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_TIMEOUT_SECONDS="${REDIS_TIMEOUT_SECONDS:-60}"
REDIS_HOST_PORT="${REDIS_HOST_PORT:-${REDIS_PORT:-6379}}"
LOKI_PORT="${LOKI_PORT:-3100}"
LOKI_TIMEOUT_SECONDS="${LOKI_TIMEOUT_SECONDS:-60}"
GRAFANA_TIMEOUT_SECONDS="${GRAFANA_TIMEOUT_SECONDS:-90}"
MINIO_HOST_PORT="${MINIO_HOST_PORT:-${MINIO_PORT:-9000}}"
PODMAN_AUTO_HOST_FALLBACK="${PODMAN_AUTO_HOST_FALLBACK:-true}"
HOST_INTERNAL_ADDR="${HOST_INTERNAL_ADDR:-host.containers.internal}"
PODMAN_HOST_FALLBACK_ACTIVE="${PODMAN_HOST_FALLBACK_ACTIVE:-false}"
fallback_attempted=false
fallback_used_overall=false
TELEMETRY_SEED_STATUS="pending"
TELEMETRY_SEEDED_COUNT="unknown"
TELEMETRY_SEED_ATTEMPTS_USED=0
TELEMETRY_SEED_RESET_COUNT=0
TELEMETRY_SEED_ENDPOINT="${TELEMETRY_SEED_ENDPOINT:-http://localhost:${PM_PORT}/api/v1/telemetry/ui?limit=50}"
TELEMETRY_MIN_SEEDED="${TELEMETRY_MIN_SEEDED:-5}"
TELEMETRY_HEALTH_ENDPOINT="${TELEMETRY_HEALTH_ENDPOINT:-http://localhost:${PM_PORT}/health/telemetry}"
TELEMETRY_HEALTH_STATUS="unknown"
TELEMETRY_HEALTH_MESSAGE=""
TELEMETRY_HEALTH_TOTAL="unknown"
TELEMETRY_HEALTH_SEEDED="unknown"
TELEMETRY_HEALTH_LAST_EVENT=""
TELEMETRY_HEALTH_LAST_SEEDED=""
TELEMETRY_HEALTH_FALLBACK="unknown"

usage() {
  cat <<USAGE
Usage: ${0##*/} [--loop] [--interval seconds]

Options:
  --loop             Run tests continuously. The stack is restarted before each run.
  --interval SEC     Sleep seconds between loop iterations (default: 600).
  -h, --help         Show this help message.

Environment variables:
  PM_PORT            Host port for pm-service (default: 3001)
  MINIO_PORT         Host port for MinIO (default: 9000)
  MINIO_TIMEOUT_SECONDS  Maximum wait for MinIO readiness (default: 60)
  TIMEOUT_SECONDS    Maximum wait for pm-service health (default: 60)
  POLL_INTERVAL      Poll interval while waiting for health (default: 1)
  LOG_DIR            Directory to store collected logs (default: logs/poc-smoke)
  RETRY_LIMIT        Number of retries before giving up (default: 1)
  RETRY_DELAY_SECONDS  Sleep seconds before retrying on failure (default: 15)
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

export USE_MINIO

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
  LAST_LOG_FILE_MINIO="${LOG_DIR}/podman_logs_${reason}_${timestamp}_minio.log"
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" logs --tail=200 minio) >"${LAST_LOG_FILE_MINIO}" 2>&1 || true
  LAST_LOG_FILE_PM="${LOG_DIR}/podman_logs_${reason}_${timestamp}_pm-service.log"
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" logs --tail=200 pm-service) >"${LAST_LOG_FILE_PM}" 2>&1 || true
}

notify_slack() {
  local status="$1"
  local message="$2"
  if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
    return
  fi
  if [[ "$status" != "success" && "$status" != "warning" && "${ALLOW_FAILURE_NOTIFY:-1}" != "1" ]]; then
    return
  fi

  local duration=$(( $(date +%s) - START_TIME ))
  local emoji=":x:"
  case "$status" in
    success) emoji=":white_check_mark:" ;;
    warning) emoji=":warning:" ;;
  esac

  local log_lines=()
  if [[ -n "$LAST_LOG_FILE" ]]; then
    log_lines+=("Stack: $LAST_LOG_FILE")
  fi
  if [[ -n "$LAST_LOG_FILE_MINIO" ]]; then
    log_lines+=("MinIO: $LAST_LOG_FILE_MINIO")
  fi
  if [[ -n "$LAST_LOG_FILE_PM" ]]; then
    log_lines+=("pm-service: $LAST_LOG_FILE_PM")
  fi
  local log_info=""
  if (( ${#log_lines[@]} > 0 )); then
    log_info="Logs:"
    for entry in "${log_lines[@]}"; do
      log_info+=$'
'"${entry}"
    done
  fi

  local context="Matrix: ${MATRIX_NAME:-unknown}
Workflow: ${GITHUB_WORKFLOW_NAME:-n/a}"
  if [[ -n "${GITHUB_RUN_URL:-}" ]]; then
    context+="
Run: ${GITHUB_RUN_URL}"
  fi

  local body
  body=$(printf "%s %s
Duration: %ss
%s" "${emoji}" "${message}" "${duration}" "${context}")
  if [[ -n "$log_info" ]]; then
    body+=$'
'"${log_info}"
  fi

  slack_send "$status" "PoC Live Smoke (${status})" "$body"
}
cleanup() {
  echo "[cleanup] stopping PoC stack"
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" down >/dev/null 2>&1) || true
}

trap cleanup EXIT

write_summary() {
  local status="$1"
  local file="${LOG_DIR}/last_summary.json"
  local fallback="${fallback_used_overall:-false}"
  if [[ -z "${fallback}" ]]; then
    fallback=false
  fi
  local fallback_json=false
  if [[ "${fallback,,}" == "true" ]]; then
    fallback_json=true
  fi
  collect_telemetry_health_summary || true
  local telemetry_status="${TELEMETRY_SEED_STATUS:-unknown}"
  local telemetry_seeded="${TELEMETRY_SEEDED_COUNT:-unknown}"
  local telemetry_attempts="${TELEMETRY_SEED_ATTEMPTS_USED:-0}"
  local telemetry_seeded_json="\"${telemetry_seeded}\""
  if [[ "${telemetry_seeded}" =~ ^[0-9]+$ ]]; then
    telemetry_seeded_json="${telemetry_seeded}"
  fi
  local telemetry_attempts_json="\"${telemetry_attempts}\""
  if [[ "${telemetry_attempts}" =~ ^[0-9]+$ ]]; then
    telemetry_attempts_json="${telemetry_attempts}"
  fi
  local tele_health_total_json="\"${TELEMETRY_HEALTH_TOTAL}\""
  if [[ "${TELEMETRY_HEALTH_TOTAL}" =~ ^[0-9]+$ ]]; then
    tele_health_total_json="${TELEMETRY_HEALTH_TOTAL}"
  fi
  local tele_health_seeded_json="\"${TELEMETRY_HEALTH_SEEDED}\""
  if [[ "${TELEMETRY_HEALTH_SEEDED}" =~ ^[0-9]+$ ]]; then
    tele_health_seeded_json="${TELEMETRY_HEALTH_SEEDED}"
  fi
  local tele_health_fallback_json=false
  if [[ "${TELEMETRY_HEALTH_FALLBACK}" =~ ^(true|True|TRUE)$ ]]; then
    tele_health_fallback_json=true
  elif [[ "${TELEMETRY_HEALTH_FALLBACK}" =~ ^(false|False|FALSE)$ ]]; then
    tele_health_fallback_json=false
  else
    tele_health_fallback_json=false
  fi
  mkdir -p "${LOG_DIR}"
  cat >"${file}" <<JSON
{
  "status": "${status}",
  "failure_reason": "${FAIL_REASON:-}",
  "runs": ${LOOP_COUNT:-0},
  "attempt": ${ATTEMPT:-0},
  "fallback_used": ${fallback_json},
  "telemetry": {
    "status": "${telemetry_status}",
    "seeded_count": ${telemetry_seeded_json},
    "attempts": ${telemetry_attempts_json}
  },
  "telemetry_health": {
    "status": "${TELEMETRY_HEALTH_STATUS}",
    "message": "${TELEMETRY_HEALTH_MESSAGE}",
    "events": {
      "total": ${tele_health_total_json},
      "seeded": ${tele_health_seeded_json},
      "last_event_at": "${TELEMETRY_HEALTH_LAST_EVENT}",
      "last_seeded_at": "${TELEMETRY_HEALTH_LAST_SEEDED}"
    },
    "fallback_active": ${tele_health_fallback_json}
  }
}
JSON
}

enable_host_internal_fallback() {
  local fallback_host="${HOST_INTERNAL_ADDR}"
  echo "[fallback] enabling host fallback via ${fallback_host}"
  export AMQP_URL="amqp://guest:guest@${fallback_host}:${RABBITMQ_HOST_PORT}"
  export REDIS_URL="redis://${fallback_host}:${REDIS_HOST_PORT}"
  export MINIO_ENDPOINT="${fallback_host}"
  export MINIO_PUBLIC_ENDPOINT="${fallback_host}"
  export MINIO_PUBLIC_PORT="${MINIO_HOST_PORT}"
  export POC_LOKI_URL="http://localhost:${LOKI_PORT}"
  export PODMAN_HOST_FALLBACK_ACTIVE=true
  fallback_used_overall=true
  notify_slack "warning" "Host fallback enabled (attempt=${ATTEMPT:-?}, host=${fallback_host})"
}

should_attempt_host_fallback() {
  [[ "${PODMAN_AUTO_HOST_FALLBACK,,}" == "true" && "${fallback_attempted}" != "true" ]]
}

start_stack() {
  echo "[stack] restarting PoC stack"
  if [[ "${PODMAN_HOST_FALLBACK_ACTIVE}" == "true" ]]; then
    echo "[stack] host fallback active (AMQP_URL=${AMQP_URL:-unset}, REDIS_URL=${REDIS_URL:-unset}, MINIO_ENDPOINT=${MINIO_ENDPOINT:-unset}, POC_LOKI_URL=${POC_LOKI_URL:-unset})"
  fi
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" down >/dev/null 2>&1) || true
  (cd "${PROJECT_DIR}" && podman-compose -f "${COMPOSE_FILE}" up -d --build)
}

wait_for_minio() {
  if [[ "${USE_MINIO}" != "true" ]]; then
    return 0
  fi
  local elapsed=0
  local ready_url="http://localhost:${MINIO_PORT}/minio/health/ready"
  local live_url="http://localhost:${MINIO_PORT}/minio/health/live"
  echo "[health] waiting for MinIO on ${ready_url}"
  until curl -fsS "${ready_url}" >/dev/null 2>&1 || curl -fsS "${live_url}" >/dev/null 2>&1; do
    sleep "${POLL_INTERVAL}"
    elapsed=$((elapsed + POLL_INTERVAL))
    if (( elapsed >= MINIO_TIMEOUT )); then
      echo "[health] ERROR: MinIO did not become healthy within ${MINIO_TIMEOUT}s" >&2
      collect_logs "minio"
      notify_slack "failure" "MinIO failed readiness check"
      return 1
    fi
  done
  echo "[health] MinIO is ready"
  return 0
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
      if [[ "${PODMAN_AUTO_HOST_FALLBACK,,}" == "true" && "${fallback_attempted}" != "true" ]]; then
        echo "[health] host fallback will be attempted; suppressing Slack failure notification" >&2
      else
        notify_slack "failure" "pm-service failed health check"
      fi
      return 1
    fi
  done
  echo "[health] pm-service is ready"
  return 0
}

check_metrics_summary() {
  local url="http://localhost:${PM_PORT}/metrics/summary"
  local attempts=0
  local response=""
  echo "[health] checking metrics summary at ${url}"
  while (( attempts < 3 )); do
    if response=$(curl -fsS "$url" 2>/dev/null); then
      echo "[health] metrics summary ok"
      echo "$response" > "${LOG_DIR}/last_metrics_summary.json"
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  echo "[health] ERROR: metrics summary not reachable" >&2
  collect_logs "metrics"
  notify_slack "failure" "metrics summary check failed"
  return 1
}

check_metrics_stream() {
  local url="http://localhost:${PM_PORT}/metrics/stream"
  echo "[health] checking metrics stream at ${url}"
  local first_line
  set +e
  first_line=$(timeout 10s curl -fsN "$url" | { IFS= read -r line && printf '%s' "$line"; })
  local capture_status=$?
  set -e
  if (( capture_status != 0 )); then
    echo "[health] ERROR: metrics stream unreachable" >&2
    collect_logs "metrics-stream"
    notify_slack "failure" "metrics stream check failed"
    return 1
  fi
  if [[ "$first_line" != data:* ]]; then
    echo "[health] ERROR: metrics stream unexpected payload: $first_line" >&2
    collect_logs "metrics-stream"
    notify_slack "failure" "metrics stream returned unexpected payload"
    return 1
  fi
  echo "$first_line" > "${LOG_DIR}/last_metrics_stream.txt"
  echo "[health] metrics stream ok"
  return 0
}

check_telemetry_endpoint() {
  local url="http://localhost:${PM_PORT}/api/v1/telemetry/ui"
  local marker="smoke-$(date +%s%N)"
  echo "[health] posting telemetry probe ${marker}"
  if ! curl -fsS -X POST "$url" -H 'Content-Type: application/json' -d "{\"component\":\"poc_smoke\",\"event\":\"probe\",\"detail\":{\"marker\":\"$marker\"}}" >/dev/null; then
    echo "[health] ERROR: telemetry POST failed" >&2
    collect_logs "telemetry"
    notify_slack "failure" "telemetry POST failed"
    return 1
  fi
  sleep 1
  if ! curl -fsS "$url" | grep -q "$marker"; then
    echo "[health] ERROR: telemetry marker not found" >&2
    collect_logs "telemetry"
    notify_slack "failure" "telemetry marker missing"
    return 1
  fi
  echo "[health] telemetry endpoint ok"
  return 0
}

check_telemetry_seed() {
  local url="${TELEMETRY_SEED_ENDPOINT:-http://localhost:${PM_PORT}/api/v1/telemetry/ui?limit=50}"
  local minimum="${TELEMETRY_MIN_SEEDED:-5}"
  local interpreter=""
  TELEMETRY_SEED_STATUS="verifying"
  TELEMETRY_SEEDED_COUNT="unknown"
  TELEMETRY_SEED_ATTEMPTS_USED=0
  for candidate in "${PYTHON_BIN:-}" python3 python; do
    if [[ -n "$candidate" ]] && command -v "$candidate" >/dev/null 2>&1; then
      interpreter="$candidate"
      break
    fi
  done
  if [[ -z "$interpreter" ]]; then
    echo "[health] ERROR: python interpreter not available for telemetry seed verification" >&2
    collect_logs "telemetry-seed"
    notify_slack "failure" "telemetry seed verification skipped (no python)"
    TELEMETRY_SEED_STATUS="skipped-no-python"
    TELEMETRY_SEEDED_COUNT="n/a"
    return 1
  fi
  local response
  if ! response=$(curl -fsS "$url" 2>/dev/null); then
    echo "[health] ERROR: telemetry seed endpoint unreachable (${url})" >&2
    collect_logs "telemetry-seed"
    notify_slack "failure" "telemetry seed endpoint unreachable"
    TELEMETRY_SEED_STATUS="failed-endpoint"
    TELEMETRY_SEEDED_COUNT="unreachable"
    TELEMETRY_SEED_ATTEMPTS_USED=1
    return 1
  fi
  local output
  local status
  set +e
output=$(printf '%s' "$response" | "$interpreter" - "$minimum" <<'PY2'
import json
import sys

try:
    expected = max(0, int(sys.argv[1]))
except Exception:
    expected = 0

try:
    payload = json.load(sys.stdin)
except Exception as exc:
    print(f"Telemetry response JSON decode error: {exc}")
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
  status=$?
  set -e
  if (( status != 0 )); then
    if [[ -n "$output" ]]; then
      echo "[health] ERROR: telemetry seed verification failed - $output" >&2
    else
      echo "[health] ERROR: telemetry seed verification failed" >&2
    fi
    collect_logs "telemetry-seed"
    notify_slack "failure" "telemetry seed verification failed"
    TELEMETRY_SEED_STATUS="failed"
    TELEMETRY_SEEDED_COUNT="failed"
    TELEMETRY_SEED_ATTEMPTS_USED=1
    return 1
  fi
  echo "[health] telemetry seed ok - $output"
  TELEMETRY_SEED_STATUS="verified"
  TELEMETRY_SEED_ATTEMPTS_USED=1
  # Parser output example: "seeded events: 5 (expected >= 5)"
  local seeded_regex='seeded events: ([0-9]+)'
  if [[ "$output" =~ $seeded_regex ]]; then
    TELEMETRY_SEEDED_COUNT="${BASH_REMATCH[1]}"
  else
    TELEMETRY_SEEDED_COUNT="unknown"
  fi
  return 0
}

collect_telemetry_health_summary() {
  local url="${TELEMETRY_HEALTH_ENDPOINT:-http://localhost:${PM_PORT}/health/telemetry}"
  TELEMETRY_HEALTH_STATUS="unknown"
  TELEMETRY_HEALTH_MESSAGE=""
  TELEMETRY_HEALTH_TOTAL="unknown"
  TELEMETRY_HEALTH_SEEDED="unknown"
  TELEMETRY_HEALTH_LAST_EVENT=""
  TELEMETRY_HEALTH_LAST_SEEDED=""
  TELEMETRY_HEALTH_FALLBACK="unknown"

  local response
  if ! response=$(curl -fsS "$url" 2>/dev/null); then
    TELEMETRY_HEALTH_MESSAGE="request failed"
    return 1
  fi

  local interpreter=""
  for candidate in "${PYTHON_BIN:-}" python3 python; do
    if [[ -n "$candidate" ]] && command -v "$candidate" >/dev/null 2>&1; then
      interpreter="$candidate"
      break
    fi
  done
  if [[ -z "$interpreter" ]]; then
    TELEMETRY_HEALTH_MESSAGE="python interpreter not available"
    return 1
  fi

  local parsed
  set +e
  parsed=$(SUMMARY_FILE=/dev/null printf '%s' "$response" | "$interpreter" <<'PY'
import json, os, sys

def emit(key, value):
    import json
    print(f"{key}={json.dumps(value)}")

try:
    data = json.load(sys.stdin)
except Exception as exc:
    emit('STATUS', 'error')
    emit('MESSAGE', f'parse error: {exc}')
    emit('TOTAL', 'unknown')
    emit('SEEDED', 'unknown')
    emit('LAST_EVENT', '')
    emit('LAST_SEEDED', '')
    emit('FALLBACK', 'unknown')
    sys.exit(0)

emit('STATUS', data.get('status', 'unknown'))
emit('MESSAGE', data.get('message', ''))
events = data.get('events') or {}
emit('TOTAL', events.get('total', 'unknown'))
emit('SEEDED', events.get('seeded', 'unknown'))
emit('LAST_EVENT', events.get('lastEventAt', events.get('last_event_at', '')))
emit('LAST_SEEDED', events.get('lastSeededAt', events.get('last_seeded_at', '')))
emit('FALLBACK', data.get('fallbackActive', False))
PY
  )
  local status=$?
  set -e
  if (( status != 0 )); then
    TELEMETRY_HEALTH_MESSAGE="parser error"
    return 1
  fi

  eval "$parsed"
  TELEMETRY_HEALTH_STATUS="${STATUS:-unknown}"
  TELEMETRY_HEALTH_MESSAGE="${MESSAGE:-}"
  TELEMETRY_HEALTH_TOTAL="${TOTAL:-unknown}"
  TELEMETRY_HEALTH_SEEDED="${SEEDED:-unknown}"
  TELEMETRY_HEALTH_LAST_EVENT="${LAST_EVENT:-}"
  TELEMETRY_HEALTH_LAST_SEEDED="${LAST_SEEDED:-}"
  TELEMETRY_HEALTH_FALLBACK="${FALLBACK:-unknown}"
  return 0
}

wait_for_rabbitmq() {
  local elapsed=0
  local auth="${RABBITMQ_USER}:${RABBITMQ_PASSWORD}"
  local url="http://localhost:${RABBITMQ_MANAGEMENT_PORT}/api/healthchecks/node"
  echo "[health] waiting for RabbitMQ management on ${url}"
  until curl -fsS -u "$auth" "$url" >/dev/null 2>&1; do
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
    if (( elapsed >= RABBITMQ_TIMEOUT_SECONDS )); then
      echo "[health] ERROR: RabbitMQ management API not ready within ${RABBITMQ_TIMEOUT_SECONDS}s" >&2
      collect_logs "rabbitmq"
      notify_slack "failure" "RabbitMQ health check failed"
      return 1
    fi
  done
  echo "[health] RabbitMQ is ready"
  return 0
}

wait_for_redis() {
  local elapsed=0
  echo "[health] waiting for Redis on tcp://localhost:${REDIS_PORT}"
  until python - <<'PY'
import socket, os
host = '127.0.0.1'
port = int(os.environ.get('REDIS_PORT', '6379'))
try:
    with socket.create_connection((host, port), timeout=1):
        pass
except Exception:
    raise SystemExit(1)
PY
  do
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
    if (( elapsed >= REDIS_TIMEOUT_SECONDS )); then
      echo "[health] ERROR: Redis not reachable within ${REDIS_TIMEOUT_SECONDS}s" >&2
      collect_logs "redis"
      notify_slack "failure" "Redis health check failed"
      return 1
    fi
  done
  echo "[health] Redis is ready"
  return 0
}

wait_for_loki() {
  local elapsed=0
  local url="http://localhost:${LOKI_PORT}/ready"
  echo "[health] waiting for Loki on ${url}"
  until curl -fsS "$url" >/dev/null 2>&1; do
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
    if (( elapsed >= LOKI_TIMEOUT_SECONDS )); then
      echo "[health] ERROR: Loki not ready within ${LOKI_TIMEOUT_SECONDS}s" >&2
      collect_logs "loki"
      notify_slack "failure" "Loki health check failed"
      return 1
    fi
  done
  echo "[health] Loki is ready"
  return 0
}

wait_for_grafana() {
  if [[ "$CHECK_GRAFANA_ALERTS" != "true" && "$CHECK_GRAFANA_DASHBOARDS" != "true" ]]; then
    return 0
  fi
  local elapsed=0
  local url="http://${GRAFANA_HOST}:${GRAFANA_PORT}/api/health"
  echo "[health] waiting for Grafana on ${url}"
  until curl -fsS -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" "$url" >/dev/null 2>&1; do
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
    if (( elapsed >= GRAFANA_TIMEOUT_SECONDS )); then
      echo "[health] ERROR: Grafana health endpoint not ready within ${GRAFANA_TIMEOUT_SECONDS}s" >&2
      collect_logs "grafana"
      notify_slack "failure" "Grafana health check failed"
      return 1
    fi
  done
  echo "[health] Grafana is ready"
  return 0
}

check_grafana_alerts() {
  if [[ "$CHECK_GRAFANA_ALERTS" != "true" ]]; then
    return 0
  fi
  local rules_url="http://${GRAFANA_HOST}:${GRAFANA_PORT}/api/ruler/grafana/api/v1/rules"
  local alerts_url="http://${GRAFANA_HOST}:${GRAFANA_PORT}/api/alertmanager/grafana/api/v2/alerts"
  local auth="${GRAFANA_USER}:${GRAFANA_PASSWORD}"
  echo "[health] checking Grafana alert rules at ${rules_url}"
  local rules_response
  if ! rules_response=$(curl -fsS -u "$auth" "$rules_url" 2>/dev/null); then
    echo "[health] ERROR: Grafana rules query failed" >&2
    collect_logs "grafana-rules"
    notify_slack "failure" "Grafana rules query failed"
    return 1
  fi
  echo "$rules_response" > "${LOG_DIR}/last_grafana_rules.json"
  if ! echo "$rules_response" | grep -q 'TelemetryFallbackSpike'; then
    echo "[health] ERROR: TelemetryFallbackSpike alert rule not found" >&2
    collect_logs "grafana-rules"
    notify_slack "failure" "TelemetryFallbackSpike rule missing"
    return 1
  fi

  echo "[health] checking Grafana active alerts at ${alerts_url}"
  local alerts_response
  if ! alerts_response=$(curl -fsS -u "$auth" "$alerts_url" 2>/dev/null); then
    echo "[health] ERROR: Grafana alerts query failed" >&2
    collect_logs "grafana-alerts"
    notify_slack "failure" "Grafana alerts query failed"
    return 1
  fi
  echo "$alerts_response" > "${LOG_DIR}/last_grafana_alerts.json"
  if echo "$alerts_response" | grep -q '"alertname":"TelemetryFallbackSpike"'; then
    echo "[health] WARNING: TelemetryFallbackSpike alert active" >&2
    collect_logs "grafana-alerts"
    notify_slack "failure" "TelemetryFallbackSpike alert active"
    return 1
  fi
  echo "[health] Grafana alerts ok"
  return 0
}

check_grafana_dashboards() {
  if [[ "$CHECK_GRAFANA_DASHBOARDS" != "true" ]]; then
    return 0
  fi
  local search_url="http://${GRAFANA_HOST}:${GRAFANA_PORT}/api/search?type=dash-db&limit=200"
  local manifest_path="${ROOT_DIR}/poc/event-backbone/local/grafana/provisioning/dashboards/manifest.json"
  local auth="${GRAFANA_USER}:${GRAFANA_PASSWORD}"
  echo "[health] checking Grafana dashboards at ${search_url}"
  local dashboards_response
  if ! dashboards_response=$(curl -fsS -u "$auth" "$search_url" 2>/dev/null); then
    echo "[health] ERROR: Grafana dashboard search failed" >&2
    collect_logs "grafana-dashboards"
    notify_slack "failure" "Grafana dashboard search failed"
    return 1
  fi
  local dashboards_file="${LOG_DIR}/last_grafana_dashboards.json"
  echo "$dashboards_response" >"$dashboards_file"
  DASHBOARD_MANIFEST="$manifest_path" \ 
  dashboards_file="$dashboards_file" python - <<'PY'
import json, os, sys
payload_path = os.environ.get('dashboards_file')
manifest_path = os.environ.get('DASHBOARD_MANIFEST')
if not manifest_path or not os.path.exists(manifest_path):
    print('[health] ERROR: dashboard manifest not found', manifest_path)
    sys.exit(1)
try:
    manifest = json.load(open(manifest_path, 'r'))
except Exception as exc:
    print(f"[health] ERROR: unable to parse manifest: {exc}")
    sys.exit(1)
expected = manifest.get('dashboards', [])
try:
    data = json.load(open(payload_path, 'r'))
except Exception as exc:
    print(f"[health] ERROR: unable to parse Grafana dashboard response: {exc}")
    sys.exit(1)
titles = {item.get('title'): item for item in data if isinstance(item, dict)}
uids = {item.get('uid'): item for item in data if isinstance(item, dict)}
missing_titles = [entry['title'] for entry in expected if entry['title'] not in titles]
if missing_titles:
    print(f"[health] ERROR: missing Grafana dashboards: {missing_titles}")
    sys.exit(1)
missing_uids = [entry['uid'] for entry in expected if entry['uid'] not in uids]
if missing_uids:
    print(f"[health] ERROR: missing Grafana dashboard UIDs: {missing_uids}")
    sys.exit(1)
PY
  local status=$?
  if (( status != 0 )); then
    collect_logs "grafana-dashboards"
    notify_slack "failure" "Grafana dashboard check failed"
    return 1
  fi
  echo "[health] Grafana dashboards ok"
  return 0
}

check_grafana_manifest() {
  if [[ "${CHECK_GRAFANA_MANIFEST}" != "true" ]]; then
    return 0
  fi
  if [[ ! -f "${GRAFANA_MANIFEST_SCRIPT}" ]]; then
    echo "[grafana] manifest script not found: ${GRAFANA_MANIFEST_SCRIPT}" >&2
    return 1
  fi
  local py
  py=$(resolve_python_bin)
  if [[ -z "${py}" ]]; then
    echo "[grafana] python interpreter not found for manifest validation" >&2
    return 1
  fi
  echo "[grafana] validating dashboard manifest"
  if ! "${py}" "${GRAFANA_MANIFEST_SCRIPT}" >/dev/null; then
    echo "[grafana] manifest validation failed" >&2
    collect_logs "grafana_manifest"
    return 1
  fi
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

run_metrics_stress() {
  if [[ "$RUN_METRICS_STRESS" != "true" ]]; then
    return 0
  fi
  echo "[tests] running metrics stream stress with ${METRICS_STRESS_CLIENTS} clients (mode=${METRICS_STREAM_MODE:-sse})"
  if ! METRICS_STREAM_CLIENTS="${METRICS_STRESS_CLIENTS}" METRICS_STREAM_ITERATIONS="${METRICS_STREAM_ITERATIONS}" METRICS_STREAM_URL="http://localhost:${PM_PORT}/metrics/stream" node "${ROOT_DIR}/scripts/metrics_stream_stress.js"; then
    echo "[tests] metrics stream stress failed" >&2
    collect_logs "metrics-stress"
    notify_slack "failure" "metrics stream stress failed"
    return 1
  fi
  return 0
}

STATUS="success"
FAIL_REASON=""
LOOP_COUNT=0

while true; do
  LOOP_COUNT=$((LOOP_COUNT + 1))
  ATTEMPT=0
  fallback_attempted=false
  fallback_used_overall=false
  while true; do
    ATTEMPT=$((ATTEMPT + 1))
    echo "[run] cycle ${LOOP_COUNT} attempt ${ATTEMPT}/${RETRY_LIMIT}"
    if (( ATTEMPT < RETRY_LIMIT )); then
      ALLOW_FAILURE_NOTIFY=0
    else
      ALLOW_FAILURE_NOTIFY=1
    fi

    start_stack
    STATUS="success"
    FAIL_REASON=""

    if ! wait_for_rabbitmq; then
      STATUS="failure"
      FAIL_REASON="rabbitmq"
    elif ! wait_for_redis; then
      STATUS="failure"
      FAIL_REASON="redis"
    elif ! wait_for_minio; then
      STATUS="failure"
      FAIL_REASON="minio_health"
    elif ! wait_for_loki; then
      STATUS="failure"
      FAIL_REASON="loki"
    elif ! wait_for_grafana; then
      STATUS="failure"
      FAIL_REASON="grafana"
    elif ! wait_for_health; then
      if should_attempt_host_fallback; then
        echo "[fallback] pm-service health check failed; retrying with host fallback (${HOST_INTERNAL_ADDR})"
        enable_host_internal_fallback
        fallback_attempted=true  # guard against repeated fallback within the same attempt
        continue
      fi
      STATUS="failure"
      FAIL_REASON="pm_health"
    elif ! check_metrics_summary; then
      STATUS="failure"
      FAIL_REASON="metrics_summary"
    elif ! check_metrics_stream; then
      STATUS="failure"
      FAIL_REASON="metrics_stream"
    elif ! check_telemetry_endpoint; then
      STATUS="failure"
      FAIL_REASON="telemetry"
    elif ! check_telemetry_seed; then
      STATUS="failure"
      FAIL_REASON="telemetry_seed"
    elif ! check_grafana_manifest; then
      STATUS="failure"
      FAIL_REASON="grafana_manifest"
    elif ! check_grafana_dashboards; then
      STATUS="failure"
      FAIL_REASON="grafana_dashboards"
    elif ! check_grafana_alerts; then
      STATUS="failure"
      FAIL_REASON="grafana_alerts"
    elif ! run_tests; then
      STATUS="failure"
      FAIL_REASON="playwright"
    elif ! run_metrics_stress; then
      STATUS="failure"
      FAIL_REASON="metrics_stress"
    fi

    if [[ "$STATUS" == "success" ]]; then
      echo "[run] cycle ${LOOP_COUNT} attempt ${ATTEMPT} succeeded"
      break
    fi

    if (( ATTEMPT >= RETRY_LIMIT )); then
      echo "[error] cycle ${LOOP_COUNT} failed after ${ATTEMPT} attempt(s) (reason: ${FAIL_REASON:-unknown})"
      break 2
    fi

    echo "[retry] cycle ${LOOP_COUNT} attempt ${ATTEMPT} failed (${FAIL_REASON:-unknown}), retrying in ${RETRY_DELAY}s"
    sleep "${RETRY_DELAY}"
  done

  ALLOW_FAILURE_NOTIFY=1

  if [[ "$STATUS" != "success" ]]; then
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

write_summary "$STATUS"

if [[ "$STATUS" == "success" ]]; then
  local fallback_note="fallback=unused"
  if [[ "${fallback_used_overall}" == "true" ]]; then
    fallback_note="fallback=used"
  fi
  local telemetry_note="telemetry=${TELEMETRY_SEED_STATUS}"
  telemetry_note+=" (seeded=${TELEMETRY_SEEDED_COUNT}, min=${TELEMETRY_MIN_SEEDED}, attempts=${TELEMETRY_SEED_ATTEMPTS_USED})"
  if [[ -n "${TELEMETRY_SEED_ATTEMPTS_USED:-}" && ${TELEMETRY_SEED_ATTEMPTS_USED} -gt 1 ]]; then
    telemetry_note+=" (auto-reset retried)"
  fi
  notify_slack "success" "Live smoke completed successfully (runs=${LOOP_COUNT}, ${fallback_note}, ${telemetry_note})"
fi
