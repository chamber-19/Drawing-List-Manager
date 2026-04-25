"""
core/project_config.py — Per-project marker file and user-level recent list.

Files managed:
  ``.r3p-project.json``  — per-project marker, lives in the project folder.
  ``recent.json``        — user-level list of recently opened projects:
                           Windows:  %APPDATA%\\chamber-19\\drawing-list-manager\\recent.json
                           Linux/macOS: ~/.config/chamber-19/drawing-list-manager/recent.json

API:
  create_project(folder, project_number, project_name, paths) → marker dict
  read_marker(marker_path)                                     → marker dict
  resolve_paths(marker)                                        → dict[str, str]
  add_recent(marker_path)                                      → None
  list_recent()                                                → list[dict]
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

# Maximum number of recent projects to keep.
_MAX_RECENT = 10

# Marker file name placed inside the project folder.
MARKER_FILENAME = ".r3p-project.json"


# ── Path helpers ──────────────────────────────────────────────────────────

def _recent_json_path() -> str:
    """Return the platform-appropriate path for recent.json."""
    if sys.platform == "win32":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
    else:
        base = os.path.join(os.path.expanduser("~"), ".config")
    return os.path.join(base, "chamber-19", "drawing-list-manager", "recent.json")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ── Marker ────────────────────────────────────────────────────────────────

def create_project(
    folder: str,
    project_number: str,
    project_name: str = "",
    paths: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Create a new project folder with a marker file and an empty register.

    Parameters
    ----------
    folder:
        Absolute path to the project root directory (will be created if it
        does not exist).
    project_number:
        R3P project number string, e.g. ``"R3P-25074"``.
    project_name:
        Optional descriptive name.
    paths:
        Optional dict of named sub-paths (e.g. ``{"drawings": "drawings/"}``).

    Returns
    -------
    dict
        The marker dict that was written to disk.
    """
    from core.register import new_register, save_register

    os.makedirs(folder, exist_ok=True)

    register_filename = f"{project_number}.r3pdrawings.json"
    register_path = os.path.join(folder, register_filename)

    register = new_register(project_number, project_name)
    save_register(register_path, register)

    marker: dict[str, Any] = {
        "schema_version": 1,
        "project_number": project_number,
        "project_name": project_name,
        "created_at": _now_iso(),
        "register_file": register_filename,
        "paths": paths or {},
    }

    marker_path = os.path.join(folder, MARKER_FILENAME)
    with open(marker_path, "w", encoding="utf-8") as fh:
        json.dump(marker, fh, indent=2, ensure_ascii=False)

    add_recent(marker_path)
    return marker


def read_marker(marker_path: str) -> dict[str, Any]:
    """Read and return the project marker dict from *marker_path*."""
    if not os.path.isfile(marker_path):
        raise FileNotFoundError(f"Project marker not found: {marker_path}")
    with open(marker_path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def resolve_paths(marker: dict[str, Any]) -> dict[str, str]:
    """Resolve named sub-paths in *marker* to absolute filesystem paths.

    The marker is expected to live alongside the project folder; paths stored
    inside are relative to the marker's directory.

    Returns a dict mapping each name to its resolved absolute path.
    """
    # The marker itself doesn't store its own location, so callers should pass
    # the dict from read_marker() together with the marker directory.
    # This helper resolves the ``paths`` sub-dict relative to the marker dir.
    return {k: os.path.abspath(v) for k, v in marker.get("paths", {}).items()}


# ── Recent list ───────────────────────────────────────────────────────────

def _load_recent() -> list[dict[str, Any]]:
    path = _recent_json_path()
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save_recent(entries: list[dict[str, Any]]) -> None:
    path = _recent_json_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(entries, fh, indent=2, ensure_ascii=False)


def add_recent(marker_path: str) -> None:
    """Add *marker_path* to the recent list, deduplicating and capping at 10.

    The most-recently opened project appears first.
    """
    abs_path = os.path.abspath(marker_path)
    entries = _load_recent()

    # Deduplicate: remove any existing entry for this path.
    entries = [e for e in entries if e.get("marker_path") != abs_path]

    # Read project info from the marker if available.
    project_number = ""
    project_name = ""
    try:
        marker = read_marker(abs_path)
        project_number = marker.get("project_number", "")
        project_name = marker.get("project_name", "")
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    entries.insert(
        0,
        {
            "marker_path": abs_path,
            "project_number": project_number,
            "project_name": project_name,
            "opened_at": _now_iso(),
        },
    )

    # Cap at maximum.
    entries = entries[:_MAX_RECENT]
    _save_recent(entries)


def list_recent() -> list[dict[str, Any]]:
    """Return the recent-projects list, pruning entries whose marker is missing."""
    entries = _load_recent()
    valid = [e for e in entries if os.path.isfile(e.get("marker_path", ""))]

    # Persist the pruned list if any entries were removed.
    if len(valid) < len(entries):
        _save_recent(valid)

    return valid
