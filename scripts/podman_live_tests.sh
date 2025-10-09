#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="${ROOT_DIR}/scripts/run_podman_ui_poc.sh"

usage() {
  cat <<USAGE
Usage: ${0##*/} [options]

Runs the Podman UI PoC stack just long enough to execute the Playwright live suite
(
  npm run test:e2e:live
) and tears everything down afterwards.

Options are forwarded to run_podman_ui_poc.sh. Helpful overrides:
  UI_PORT=4107 PM_PORT=3107 ${0##*/}
  ${0##*/} --with-minio
  PODMAN_HOST_FALLBACK_MODE=never ${0##*/}

Environment defaults:
  PM_PORT (default 3105)
  UI_PORT (default 4105)
  PODMAN_HOST_FALLBACK_MODE (default force)
USAGE
}

if [[ ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -x "${RUNNER}" ]]; then
  echo "[live-tests] ERROR: ${RUNNER} is missing or not executable" >&2
  exit 1
fi

export PM_PORT="${PM_PORT:-3105}"
export UI_PORT="${UI_PORT:-4105}"
export PODMAN_HOST_FALLBACK_MODE="${PODMAN_HOST_FALLBACK_MODE:-force}"

printf '[live-tests] Starting Playwright live suite (PM_PORT=%s, UI_PORT=%s, fallback=%s)\n' \
  "${PM_PORT}" "${UI_PORT}" "${PODMAN_HOST_FALLBACK_MODE}"

exec "${RUNNER}" --tests-only "$@"
