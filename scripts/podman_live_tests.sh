#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="${ROOT_DIR}/scripts/run_podman_ui_poc.sh"

usage() {
  cat <<USAGE
Usage: ${0##*/} [options]

Runs the Podman UI PoC stack just long enough to execute the Playwright live suite via:
  run_podman_ui_poc.sh --tests-only
and tears everything down afterwards.

Options are forwarded to run_podman_ui_poc.sh. Helpful overrides:
  UI_PORT=4107 PM_PORT=3107 ${0##*/}
  ${0##*/} --with-minio
  PODMAN_HOST_FALLBACK_MODE=never ${0##*/}
  ${0##*/} --fallback-mode force

Environment defaults:
  PM_PORT (default 3105)
  UI_PORT (default 4105)
  PODMAN_HOST_FALLBACK_MODE (default force)
USAGE
}

args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    *)
      args+=("$1")
      shift
      ;;
  esac
done
set -- "${args[@]}"

if [[ ! -x "${RUNNER}" ]]; then
  echo "[live-tests] ERROR: ${RUNNER} is missing or not executable" >&2
  exit 1
fi

export PM_PORT="${PM_PORT:-3105}"
export UI_PORT="${UI_PORT:-4105}"
export PODMAN_HOST_FALLBACK_MODE="${PODMAN_HOST_FALLBACK_MODE:-force}"
EXPORT_DASHBOARDS=${PODMAN_LIVE_EXPORT_DASHBOARDS:-false}

printf '[live-tests] Starting Playwright live suite (PM_PORT=%s, UI_PORT=%s, fallback=%s)\n' \
  "${PM_PORT}" "${UI_PORT}" "${PODMAN_HOST_FALLBACK_MODE}"

LIVE_TEST_LOG_DIR="${ROOT_DIR}/logs/podman-live-tests"
mkdir -p "${LIVE_TEST_LOG_DIR}"
timestamp=$(date +"%Y%m%d_%H%M%S")
log_file="${LIVE_TEST_LOG_DIR}/run_${timestamp}.log"
echo "[live-tests] Writing combined output to ${log_file}" >&2

{
  echo "PM_PORT=${PM_PORT}"
  echo "UI_PORT=${UI_PORT}"
  echo "PODMAN_HOST_FALLBACK_MODE=${PODMAN_HOST_FALLBACK_MODE}"
  echo "EXPORT_DASHBOARDS=${EXPORT_DASHBOARDS}"
  echo
} >"${log_file}"

set +e
"${RUNNER}" --tests-only "$@" | tee -a "${log_file}"
status=${PIPESTATUS[0]}
set -e

if [[ ${EXPORT_DASHBOARDS,,} == "true" ]]; then
  export_dir="${LIVE_TEST_LOG_DIR}/dashboards_${timestamp}"
  mkdir -p "${export_dir}"
  container_name="local_grafana_1"
  if podman ps --format '{{.Names}}' | grep -q "${container_name}"; then
    if podman cp "${container_name}:/var/lib/grafana/dashboards/." "${export_dir}"; then
      echo "[live-tests] Exported dashboards to ${export_dir}" | tee -a "${log_file}"
    else
      echo "[live-tests] Failed to export dashboards from ${container_name}" | tee -a "${log_file}" >&2
    fi
  else
    echo "[live-tests] Grafana container ${container_name} not found; skipping export" | tee -a "${log_file}"
  fi
fi

exit ${status}
