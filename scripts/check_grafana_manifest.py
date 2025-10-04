#!/usr/bin/env python3
"""Validate Grafana dashboard manifest vs actual JSON files."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "poc" / "event-backbone" / "local" / "grafana" / "provisioning" / "dashboards" / "manifest.json"
DASHBOARD_DIR = ROOT / "poc" / "event-backbone" / "local" / "grafana" / "dashboards"

try:
    manifest = json.loads(MANIFEST.read_text())
except FileNotFoundError:
    print(f"Manifest not found: {MANIFEST}", file=sys.stderr)
    sys.exit(1)
except json.JSONDecodeError as exc:
    print(f"Invalid manifest JSON: {exc}", file=sys.stderr)
    sys.exit(1)

def load_dashboard(file_name: str):
    path = DASHBOARD_DIR / file_name
    try:
        return json.loads(path.read_text()), path
    except FileNotFoundError:
        print(f"Dashboard file missing: {path}", file=sys.stderr)
        return None, path
    except json.JSONDecodeError as exc:
        print(f"Invalid dashboard JSON in {path}: {exc}", file=sys.stderr)
        return None, path

errors = 0
seen_files = set()
for entry in manifest.get("dashboards", []):
    title = entry.get("title")
    uid = entry.get("uid")
    file_name = entry.get("file")
    if not all([title, uid, file_name]):
        print(f"Manifest entry incomplete: {entry}", file=sys.stderr)
        errors += 1
        continue
    dashboard, path = load_dashboard(file_name)
    if dashboard is None:
        errors += 1
        continue
    seen_files.add(file_name)
    dash_title = dashboard.get("title")
    dash_uid = dashboard.get("uid")
    if dash_title != title:
        print(f"Title mismatch for {path}: expected '{title}', got '{dash_title}'", file=sys.stderr)
        errors += 1
    if dash_uid != uid:
        print(f"UID mismatch for {path}: expected '{uid}', got '{dash_uid}'", file=sys.stderr)
        errors += 1

for path in DASHBOARD_DIR.glob('*.json'):
    if path.name not in seen_files:
        print(f"Dashboard file not referenced in manifest: {path.name}", file=sys.stderr)
        errors += 1

if errors:
    print(f"Grafana manifest validation failed with {errors} issue(s)", file=sys.stderr)
    sys.exit(1)
print("Grafana manifest validation passed")
