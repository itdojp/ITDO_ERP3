import json
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
SCRIPT = ROOT_DIR / "scripts" / "validate_grafana_dashboards.py"
DASHBOARD_DIR = ROOT_DIR / "poc" / "event-backbone" / "local" / "grafana" / "dashboards"


def run_dashboards(path: Path | None = None) -> subprocess.CompletedProcess[str]:
    args = [sys.executable, str(SCRIPT)]
    if path is not None:
        args.append(str(path))
    return subprocess.run(args, capture_output=True, text=True, check=False)


def test_repository_dashboards_are_valid():
    result = run_dashboards()
    assert result.returncode == 0
    assert "[grafana-validation] OK" in result.stdout


def test_missing_title_fails(tmp_path):
    invalid_dashboard = {
        "uid": "example",
        "panels": [],
    }
    dashboard_path = tmp_path / "bad-dashboard.json"
    dashboard_path.write_text(json.dumps(invalid_dashboard), encoding="utf-8")

    result = run_dashboards(tmp_path)
    assert result.returncode == 2
    assert "missing key 'title'" in result.stderr
