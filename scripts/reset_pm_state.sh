#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${ROOT_DIR}/poc/event-backbone/local/services/pm-service/state"
STATE_FILE="${STATE_DIR}/pm-poc-state.json"
WITH_MINIO=false
MINIO_PREFIXES="${MINIO_PREFIXES:-compliance,timesheets}"
MINIO_BUCKET="${MINIO_BUCKET:-events}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
MINIO_NETWORK="${MINIO_NETWORK:-local_default}"
MINIO_CLIENT_IMAGE="${MINIO_CLIENT_IMAGE:-docker.io/minio/mc:RELEASE.2024-08-17T01-24-54Z}"

usage() {
  cat <<USAGE
Usage: ${0##*/} [--with-minio] [--minio-prefix prefix1,prefix2,...]

Options:
  --with-minio       Also removes MinIO objects (prefixes configurable via --minio-prefix).
  --minio-prefix     Comma separated list of prefixes under the bucket to delete (default: compliance,timesheets).
  -h, --help         Show this help message.

Environment variables:
  MINIO_BUCKET          Target bucket name (default: events)
  MINIO_ROOT_USER       MinIO access key (default: minioadmin)
  MINIO_ROOT_PASSWORD   MinIO secret key (default: minioadmin)
  MINIO_NETWORK         Podman network name (default: local_default)
  MINIO_CLIENT_IMAGE    minio/mc image tag (default: RELEASE.2024-08-17T01-24-54Z)
  MINIO_PREFIXES        Default prefixes when --minio-prefix is omitted
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-minio)
      WITH_MINIO=true
      shift
      ;;
    --minio-prefix)
      if [[ $# -lt 2 ]]; then
        echo "--minio-prefix requires a value" >&2
        exit 1
      fi
      MINIO_PREFIXES="$2"
      shift 2
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

if [ "${WITH_MINIO}" = true ]; then
  if ! command -v podman >/dev/null 2>&1; then
    echo "[warn] podman not available; skipping MinIO cleanup" >&2
    exit 0
  fi
  if ! podman network exists "${MINIO_NETWORK}" >/dev/null 2>&1; then
    echo "[warn] Podman network ${MINIO_NETWORK} not found; skipping MinIO cleanup" >&2
    exit 0
  fi

  echo "Removing MinIO prefixes (${MINIO_PREFIXES}) from bucket ${MINIO_BUCKET}"
  podman run --rm \
    --network "${MINIO_NETWORK}" \
    -e "MC_HOST_poc=http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
    "${MINIO_CLIENT_IMAGE}" \
    sh -c "set -euo pipefail; for prefix in ${MINIO_PREFIXES//,/ }; do mc rm --force --recursive poc/${MINIO_BUCKET}/\$prefix || true; done" || {
      echo "[warn] Failed to remove MinIO objects" >&2
    }
fi
