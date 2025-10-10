#!/usr/bin/env bash
set -euo pipefail

PM_PORT="${PM_PORT:-3001}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
OUTPUT_DIR="${OUTPUT_DIR:-${ROOT_DIR}/logs/telemetry-health}"
TIMESTAMP=$(date -Is)
URL="${TELEMETRY_HEALTH_ENDPOINT:-http://localhost:${PM_PORT}/health/telemetry}"

mkdir -p "${OUTPUT_DIR}"
OUT_FILE="${OUTPUT_DIR}/telemetry-health.ndjson"

if ! command -v jq >/dev/null 2>&1; then
  echo "[telemetry-health] ERROR: jq is required" >&2
  exit 1
fi

response=$(curl -fsS "$URL" 2>/dev/null || true)
status="error"
message="request failed"
if [[ -n "$response" ]]; then
  status=$(printf '%s' "$response" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
  message=$(printf '%s' "$response" | jq -r '.message // ""' 2>/dev/null || echo "")
fi

message_json=$(printf '%s' "$message" | jq -Rs .)

printf '{"timestamp":"%s","status":"%s","message":%s,"payload":%s}\n' \
  "$TIMESTAMP" "$status" "$message_json" "${response:-null}" >> "$OUT_FILE"

echo "[telemetry-health] appended snapshot to $OUT_FILE"
