#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${ROOT_DIR}/poc/event-backbone/local/services/pm-service/state"
STATE_FILE="${STATE_DIR}/pm-poc-state.json"

if [ ! -d "${STATE_DIR}" ]; then
  echo "State directory not found: ${STATE_DIR}" >&2
  exit 1
fi

if [ -f "${STATE_FILE}" ]; then
  rm -f "${STATE_FILE}"
  echo "Removed state file: ${STATE_FILE}"
else
  echo "State file not present: ${STATE_FILE}"
fi

