# shellcheck shell=bash

slack_send() {
  local status="$1"
  local title="$2"
  local message="$3"
  local webhook="${SLACK_WEBHOOK_URL:-}"
  if [[ -z "${webhook}" ]]; then
    return 0
  fi

  local color="#36a64f"
  local emoji=":white_check_mark:"
  case "${status}" in
    warning)
      color="#f59e0b"
      emoji=":warning:"
      ;;
    failure)
      color="#d73a4a"
      emoji=":x:"
      ;;
  esac

  local payload
  payload=$(cat <<JSON
{
  "attachments": [
    {
      "color": "${color}",
      "title": "${title}",
      "text": "${emoji} ${message}",
      "mrkdwn_in": ["text"]
    }
  ]
}
JSON
)

  if ! curl -s -X POST -H 'Content-Type: application/json' -d "${payload}" "${webhook}" >/dev/null 2>&1; then
    echo "[slack] warning: failed to send notification (title=${title}, status=${status})" >&2
  fi
}
