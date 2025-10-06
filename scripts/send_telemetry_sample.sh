#!/usr/bin/env bash
# requires jq (sudo apt install jq)
set -euo pipefail

PORT=${PM_PORT:-3001}
BASE_URL=${TELEMETRY_BASE:-http://localhost:${PORT}}
COMPONENT=${1:-manual/test}
EVENT=${2:-log_sample}
LEVEL=${3:-info}
DETAIL=${4:-Triggered via send_telemetry_sample.sh}

payload=$(jq -n \
  --arg component "${COMPONENT}" \
  --arg event "${EVENT}" \
  --arg level "${LEVEL}" \
  --arg detail "${DETAIL}" \
  --arg timestamp "$(date -Iseconds)" \
  '{component: $component, event: $event, level: $level, detail: {message: $detail, timestamp: $timestamp}}')

curl -sS -H 'Content-Type: application/json' \
  -d "${payload}" \
  "${BASE_URL}/api/v1/telemetry/ui" > /dev/null

echo "[telemetry] sent component='${COMPONENT}', event='${EVENT}' to ${BASE_URL}"
