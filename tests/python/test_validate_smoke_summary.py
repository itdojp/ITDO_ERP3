import json
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
SCRIPT = ROOT_DIR / "scripts" / "validate_smoke_summary.py"
SAMPLE = ROOT_DIR / "scripts" / "samples" / "example_poc_smoke_summary.json"


def run_summary(path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), str(path)],
        capture_output=True,
        text=True,
        check=False,
    )


def test_example_summary_is_valid():
    result = run_summary(SAMPLE)
    assert result.returncode == 0
    assert "[summary-validation] OK" in result.stdout


def test_missing_required_section(tmp_path):
    payload = {
        "status": "success",
        "failure_reason": "",
        "runs": 1,
        "attempt": 1,
        "fallback_used": False,
    }
    summary_path = tmp_path / "summary.json"
    summary_path.write_text(json.dumps(payload), encoding="utf-8")

    result = run_summary(summary_path)
    assert result.returncode == 2
    assert "Missing key: telemetry" in result.stderr


def test_numeric_string_validation(tmp_path):
    payload = {
        "status": "success",
        "failure_reason": "",
        "runs": 1,
        "attempt": 1,
        "fallback_used": False,
        "telemetry": {
            "status": "verified",
            "seeded_count": "not-a-number",
            "attempts": "1",
        },
    }
    summary_path = tmp_path / "summary.json"
    summary_path.write_text(json.dumps(payload), encoding="utf-8")

    result = run_summary(summary_path)
    assert result.returncode == 2
    assert "telemetry: key 'seeded_count' must be numeric-like" in result.stderr
