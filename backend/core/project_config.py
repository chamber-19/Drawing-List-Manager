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
  resolve_paths(marker, marker_path)                           → dict[str, str]
  add_recent(marker_path)                                      → None
  list_recent()                                                → list[dict]

Marker ``paths`` block:
  Always carries three named keys, each relative to the marker file's own
  directory:
    - ``drawings_dir`` — folder containing live drawing files
    - ``pdfs_dir``     — folder containing rendered PDFs
    - ``index_xlsx``   — branded Excel index path (empty default; generated
                         alongside the register on save)
  Defaults are defined by ``DEFAULT_PROJECT_PATHS``; caller-supplied values
  in ``create_project(paths=...)`` override on a per-key basis.
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

# Current schema version for the marker file. Independent of the register
# schema version — the two files version independently.
MARKER_SCHEMA_VERSION = 1


# Default sub-paths for a new project marker. Always present in the
# written marker; user-supplied values in `paths` override on a per-key
# basis. All paths are relative to the marker file's directory.
DEFAULT_PROJECT_PATHS: dict[str, str] = {
    "drawings_dir": "Drawings/Live",
    "pdfs_dir":     "Drawings/PDF",
    "index_xlsx":   "",  # empty default — generated alongside the register on save
}


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
        Optional dict of named sub-paths overriding ``DEFAULT_PROJECT_PATHS``
        on a per-key basis. The keys ``drawings_dir``, ``pdfs_dir``, and
        ``index_xlsx`` are always present in the written marker.

    Returns
    -------
    dict
        The marker dict that was written to disk.
    """
    from core.register import new_register, save_register, build_register_filename, validate_project_number

    os.makedirs(folder, exist_ok=True)

    # Validate project_number format.
    if not validate_project_number(project_number):
        raise ValueError(
            f"project_number {project_number!r} is invalid. "
            "Must match R3P-<digits>, e.g. 'R3P-25074'."
        )

    marker_path = os.path.join(folder, MARKER_FILENAME)
    if os.path.exists(marker_path):
        raise FileExistsError(
            f"A project marker already exists at {marker_path}; refusing to overwrite."
        )

    register_filename = build_register_filename(project_number, project_name)
    register_path = os.path.join(folder, register_filename)

    register = new_register(project_number, project_name)
    save_register(register_path, register)

    merged_paths = {**DEFAULT_PROJECT_PATHS, **(paths or {})}

    marker: dict[str, Any] = {
        "schema_version": MARKER_SCHEMA_VERSION,
        "project_number": project_number,
        "project_name": project_name,
        "created_at": _now_iso(),
        "register_file": register_filename,
        "paths": merged_paths,
    }

    with open(marker_path, "w", encoding="utf-8") as fh:
        json.dump(marker, fh, indent=2, ensure_ascii=False)

    add_recent(marker_path)
    return marker


def read_marker(marker_path: str) -> dict[str, Any]:
    """Read and return the project marker dict from *marker_path*."""
    if not os.path.isfile(marker_path):
        raise FileNotFoundError(f"Project marker not found: {marker_path}")
    with open(marker_path, "r", encoding="utf-8") as fh:
        marker = json.load(fh)
    version = marker.get("schema_version", 1)
    if version > MARKER_SCHEMA_VERSION:
        raise ValueError(
            f"Marker file is schema_version {version}; this version of DLM supports up to "
            f"{MARKER_SCHEMA_VERSION}. Please update DLM to open this project."
        )
    return marker


def resolve_paths(marker: dict[str, Any], marker_path: str) -> dict[str, str]:
    """Resolve named sub-paths in *marker* to absolute filesystem paths.

    Paths inside the marker are stored relative to the marker's own
    directory. This function joins each one against
    ``os.path.dirname(marker_path)`` and returns absolute paths.

    Absolute paths in the marker pass through unchanged (normalised).

    Returns a dict mapping each name to its resolved absolute path.
    """
    base_dir = os.path.dirname(os.path.abspath(marker_path))
    resolved: dict[str, str] = {}
    for k, v in marker.get("paths", {}).items():
        if os.path.isabs(v):
            resolved[k] = os.path.normpath(v)
        else:
            resolved[k] = os.path.normpath(os.path.join(base_dir, v))
    return resolved


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
