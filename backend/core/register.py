"""
core/register.py — JSON register model + open/save helpers.

Register shape (schema_version 1):
{
  "schema_version": 1,
  "project_number": "R3P-25074",
  "project_name": "Optional descriptive name",
  "updated_at": "2026-04-16T10:30:00Z",
  "sets": [
    {
      "name": "P&C",
      "drawings": [
        {
          "drawing_number": "R3P-25074-E0-0001",
          "description": "DRAWING INDEX",
          "status": "READY FOR SUBMITTAL",
          "notes": null,
          "revisions": [
            {"rev": "A", "date": "2025-10-17"}
          ]
        }
      ]
    }
  ]
}
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any


SCHEMA_VERSION = 1

VALID_STATUSES = {
    "NOT CREATED YET",
    "IN DESIGN",
    "READY FOR DRAFTING",
    "READY FOR SUBMITTAL",
}

DEFAULT_SETS = ["P&C", "SUB", "BESS", "Physicals"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def new_register(project_number: str, project_name: str = "") -> dict[str, Any]:
    """Return a fresh empty register with default sets."""
    return {
        "schema_version": SCHEMA_VERSION,
        "project_number": project_number,
        "project_name": project_name,
        "updated_at": _now_iso(),
        "sets": [{"name": name, "drawings": []} for name in DEFAULT_SETS],
    }


def open_register(path: str) -> dict[str, Any]:
    """Read a .r3pdrawings.json file from disk and return the register dict."""
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Register not found: {path}")
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data


def save_register(path: str, register: dict[str, Any]) -> None:
    """Write a register dict to disk as JSON, stamping updated_at."""
    register = dict(register)
    register["updated_at"] = _now_iso()
    register.setdefault("schema_version", SCHEMA_VERSION)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(register, fh, indent=2, ensure_ascii=False)
