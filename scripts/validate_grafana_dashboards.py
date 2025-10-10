#!/usr/bin/env python3
"""Validate Grafana dashboard JSON files."""

import json
import sys
from pathlib import Path

DASHBOARD_DIR = Path("poc/event-backbone/local/grafana/dashboards")


class DashboardError(Exception):
    pass


def validate_dashboard(path: Path) -> None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise DashboardError(f"{path}: invalid JSON ({exc})") from exc

    for key in ("title", "uid", "panels"):
        if key not in data:
            raise DashboardError(f"{path}: missing key '{key}'")

    if not isinstance(data["title"], str) or not data["title"].strip():
        raise DashboardError(f"{path}: title must be a non-empty string")
    if not isinstance(data["uid"], str) or not data["uid"].strip():
        raise DashboardError(f"{path}: uid must be a non-empty string")
    if not isinstance(data["panels"], list) or not data["panels"]:
        raise DashboardError(f"{path}: panels must be a non-empty list")

    for index, panel in enumerate(data["panels"], start=1):
        if not isinstance(panel, dict):
            raise DashboardError(f"{path}: panel #{index} is not an object")
        if "title" not in panel:
            raise DashboardError(f"{path}: panel #{index} missing title")


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
