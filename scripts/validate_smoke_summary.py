#!/usr/bin/env python3
"""Validate poc_live_smoke summary JSON structure."""

import json
import sys
from pathlib import Path

REQUIRED_TOP_LEVEL = {
    "status": str,
    "failure_reason": str,
    "runs": (int, float),
    "attempt": (int, float),
    "fallback_used": bool,
    "telemetry": dict,
}

OPTIONAL_TOP_LEVEL = {
    "telemetry_health": dict,
}

TELEMETRY_REQUIRED = {
    "status": str,
    "seeded_count": (int, float, str),
    "attempts": (int, float, str),
}

TELEMETRY_HEALTH_REQUIRED = {
    "status": str,
    "message": str,
    "events": dict,
    "fallback_active": bool,
}

EVENTS_REQUIRED = {
    "total": (int, float, str),
    "seeded": (int, float, str),
    "last_event_at": str,
    "last_seeded_at": str,
}


class ValidationError(Exception):
    """Custom error for validation issues."""


def validate_mapping(mapping, required):
    for key, expected_type in required.items():
        if key not in mapping:
            raise ValidationError(f"Missing key: {key}")
        value = mapping[key]
        if not isinstance(value, expected_type):
            raise ValidationError(
                f"Key '{key}' expected {expected_type} but got {type(value)}"
            )


def validate_optional(mapping, optional):
    present = {}
    for key, expected_type in optional.items():
        if key not in mapping:
            continue
        value = mapping[key]
        if not isinstance(value, expected_type):
            raise ValidationError(
                f"Key '{key}' expected {expected_type} but got {type(value)}"
            )
        present[key] = value
    return present


def ensure_numeric_like(mapping, keys, context):
    for key in keys:
        value = mapping[key]
        if isinstance(value, str):
            try:
                float(value)
            except ValueError as exc:
                raise ValidationError(
                    f"{context}: key '{key}' must be numeric-like"
                ) from exc


def validate_summary(path: Path) -> None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValidationError(f"Invalid JSON: {exc}") from exc

    validate_mapping(data, REQUIRED_TOP_LEVEL)
    optional_values = validate_optional(data, OPTIONAL_TOP_LEVEL)

    telemetry = data["telemetry"]
    validate_mapping(telemetry, TELEMETRY_REQUIRED)

    tele_health = optional_values.get("telemetry_health")
    if tele_health:
        validate_mapping(tele_health, TELEMETRY_HEALTH_REQUIRED)
        validate_mapping(tele_health["events"], EVENTS_REQUIRED)

    # ensure numeric-like strings are convertible if provided as string
    ensure_numeric_like(telemetry, ("seeded_count", "attempts"), "telemetry")
    if tele_health:
        ensure_numeric_like(
            tele_health["events"], ("total", "seeded"), "telemetry_health.events"
        )


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: validate_smoke_summary.py <summary.json>", file=sys.stderr)
        return 1
    path = Path(argv[1])
    if not path.is_file():
        print(f"File not found: {path}", file=sys.stderr)
        return 1
    try:
        validate_summary(path)
    except (ValidationError, ValueError) as exc:
        print(f"[summary-validation] FAILED: {exc}", file=sys.stderr)
        return 2
    print(f"[summary-validation] OK: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
