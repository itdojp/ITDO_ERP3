#!/usr/bin/env python3
"""Validate Grafana dashboard JSON files."""

import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
DASHBOARD_DIR = ROOT_DIR / "poc" / "event-backbone" / "local" / "grafana" / "dashboards"


class DashboardError(Exception):
    pass


def validate_field(
    mapping: dict,
    key: str,
    expected_type: type,
    context: str,
    description: str,
) -> object:
    if key not in mapping:
        raise DashboardError(f"{context}: missing key '{key}'")
    value = mapping[key]
    if not isinstance(value, expected_type):
        raise DashboardError(f"{context}: {key} must be {description}")
    if isinstance(value, str) and not value.strip():
        raise DashboardError(f"{context}: {key} must be {description}")
    if isinstance(value, list) and not value:
        raise DashboardError(f"{context}: {key} must be {description}")
    return value


def validate_dashboard(path: Path) -> None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise DashboardError(f"{path}: invalid JSON ({exc})") from exc
    validate_field(data, "title", str, f"{path}", "a non-empty string")
    validate_field(data, "uid", str, f"{path}", "a non-empty string")
    panels = validate_field(data, "panels", list, f"{path}", "a non-empty list")

    for index, panel in enumerate(panels, start=1):
        if not isinstance(panel, dict):
            raise DashboardError(f"{path}: panel #{index} is not an object")
        validate_field(
            panel,
            "title",
            str,
            f"{path}: panel #{index}",
            "a non-empty string",
        )


def main(argv: list[str]) -> int:
    directory = DASHBOARD_DIR if len(argv) == 1 else Path(argv[1])
    if not directory.is_dir():
        print(f"Dashboard directory not found: {directory}", file=sys.stderr)
        return 1

    errors = []
    for path in sorted(directory.glob("*.json")):
        try:
            validate_dashboard(path)
            print(f"[grafana-validation] OK: {path}")
        except DashboardError as exc:
            errors.append(str(exc))

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
