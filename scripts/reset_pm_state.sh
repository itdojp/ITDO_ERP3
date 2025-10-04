#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${ROOT_DIR}/poc/event-backbone/local/services/pm-service/state"
STATE_FILE="${STATE_DIR}/pm-poc-state.json"
WITH_MINIO=false
MINIO_BUCKET="${MINIO_BUCKET:-events}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
MINIO_NETWORK="${MINIO_NETWORK:-local_default}"
MINIO_CLIENT_IMAGE="${MINIO_CLIENT_IMAGE:-docker.io/minio/mc:RELEASE.2024-08-17T01-24-54Z}"

usage() {
  cat <<USAGE
Usage: ${0##*/} [--with-minio]

Options:
  --with-minio    Also removes MinIO objects under events/compliance and events/timesheets.
  -h, --help      Show this help message.

Environment variables:
  MINIO_BUCKET          Target bucket name (default: events)
  MINIO_ROOT_USER       MinIO access key (default: minioadmin)
  MINIO_ROOT_PASSWORD   MinIO secret key (default: minioadmin)
  MINIO_NETWORK         Podman network name (default: local_default)
  MINIO_CLIENT_IMAGE    minio/mc image tag (default: RELEASE.2024-08-17T01-24-54Z)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-minio)
      WITH_MINIO=true
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
  echo "Removing MinIO objects from bucket ${MINIO_BUCKET}"
  if ! podman network exists "${MINIO_NETWORK}" >/dev/null 2>&1; then
    echo "[warn] Podman network ${MINIO_NETWORK} not found; skipping MinIO cleanup" >&2
    exit 0
  fi
  podman run --rm \
    --network "${MINIO_NETWORK}" \
    -e "MC_HOST_poc=http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
    "${MINIO_CLIENT_IMAGE}" \
    sh -c "set -euo pipefail; mc rm --force --recursive poc/${MINIO_BUCKET}/compliance || true; mc rm --force --recursive poc/${MINIO_BUCKET}/timesheets || true" || {
      echo "[warn] Failed to remove MinIO objects" >&2
    }
fi
