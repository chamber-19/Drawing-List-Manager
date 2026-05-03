"""
core/register.py — JSON register model + open/save helpers.

Register shape (schema_version 3):
{
  "schema_version": 3,
  "project_number": "R3P-25074",
  "project_name": "Optional descriptive name",
  "current_phase": "IFA",
  "updated_at": "2026-04-16T10:30:00Z",
  "drawings": [
    {
      "drawing_number": "R3P-25074-E6-0001",
      "description": "OVERALL SINGLE LINE DIAGRAM",
      "set": "P&C",
      "status": "READY FOR SUBMITTAL",
      "notes": null,
      "superseded": false,
      "revisions": [
        {"rev": "A", "date": "2025-10-17", "phase": "IFA", "percent": 30},
        {"rev": "0", "date": "2026-01-10", "phase": "IFC", "percent": null}
      ]
    }
  ]
}

Validation rules:
  - ``set`` MUST be one of VALID_SETS.
  - ``phase`` in each revision MUST be one of VALID_PHASES.
  - ``percent`` is only valid when ``phase == "IFA"`` (None otherwise).
  - IFA revs MUST be uppercase letters (regex ``^[A-Z]+$``).
  - IFC/IFR/IFB/IFF/IFRef revs that follow an IFC-numeric series MUST be
    digits (``^\\d+$``).
  - Revisions array is chronological — each entry's date >= previous date.
  - When phase transitions IFA → IFC, the next rev MUST be ``"0"``.
  - ``superseded`` (v3): MUST be a boolean if present; defaults to False
    on read if missing.
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 3

# Legacy register filename suffix.  Old projects used ``{project_number}.r3pdrawings.json``.
REGISTER_LEGACY_FILENAME = ".r3pdrawings.json"

# Compiled regex for valid project numbers.  Shared by filename builder and
# migration helper so both enforce the same rule.
_PROJECT_NUMBER_RE = re.compile(r"^R3P-\d+$")

VALID_SETS = {"P&C", "Physicals"}

VALID_PHASES = {"IFA", "IFC", "IFR", "IFB", "IFF", "IFRef"}

VALID_STATUSES = {
    "NOT CREATED YET",
    "IN DESIGN",
    "READY FOR DRAFTING",
    "READY FOR SUBMITTAL",
}


def build_register_filename(project_number: str, project_name: str) -> str:
    """Build the canonical register filename for a project.

    Pattern: ``{project_number}-{sanitized_project_name}-DrawingIndex-Metadata.json``

    ``project_name`` is sanitized — any character that is not alphanumeric,
    a hyphen, or an underscore is replaced with a hyphen.  Runs of hyphens are
    collapsed to a single hyphen, and leading/trailing hyphens are stripped.
    This keeps the filename safe for Windows, macOS, and Linux filesystems.

    If the sanitized project name is empty the name segment is omitted:
    ``{project_number}-DrawingIndex-Metadata.json``.
    """
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "-", project_name)
    safe_name = re.sub(r"-+", "-", safe_name).strip("-")
    if safe_name:
        return f"{project_number}-{safe_name}-DrawingIndex-Metadata.json"
    return f"{project_number}-DrawingIndex-Metadata.json"


def validate_project_number(project_number: str) -> bool:
    """Return True if *project_number* matches the required ``R3P-<digits>`` format."""
    return bool(_PROJECT_NUMBER_RE.match(project_number))


def find_or_migrate_register(
    project_dir: str, project_number: str, project_name: str
) -> str:
    """Return the path to the register file, renaming the legacy filename if needed.

    Resolution order:

    1. ``{project_number}-{sanitized_name}-DrawingIndex-Metadata.json`` exists
       → return its path unchanged.
    2. Legacy ``{project_number}.r3pdrawings.json`` exists → rename it in place
       to the new pattern, log the rename, return the new path.
    3. Neither exists → raise ``FileNotFoundError``.

    Raises ``ValueError`` if *project_number* is not in the expected
    ``R3P-<digits>`` format so that the value cannot introduce path traversal
    when it is incorporated into a filename.
    """
    if not _PROJECT_NUMBER_RE.match(project_number):
        raise ValueError(
            f"project_number {project_number!r} is invalid. "
            "Must match R3P-<digits>, e.g. 'R3P-25074'."
        )

    # Resolve project_dir to an absolute, canonical path so that any relative
    # or symlink components are expanded before we construct child paths.
    safe_dir = os.path.realpath(project_dir)

    # Use os.path.basename to ensure the filename component contains no path
    # separators even if the caller somehow passed a crafted value.
    new_filename = os.path.basename(build_register_filename(project_number, project_name))
    legacy_filename = os.path.basename(f"{project_number}{REGISTER_LEGACY_FILENAME}")

    new_path = os.path.join(safe_dir, new_filename)
    legacy_path = os.path.join(safe_dir, legacy_filename)

    # Verify both paths are confined to the project directory.
    # Use commonpath with realpath to handle symlinks and be robust against
    # edge cases that dirname-based comparisons may miss.
    for path in (new_path, legacy_path):
        real_path = os.path.realpath(path)
        try:
            common = os.path.commonpath([safe_dir, real_path])
        except ValueError:
            # commonpath raises ValueError on Windows when paths are on
            # different drives — that also means they're not confined.
            common = ""
        if common != safe_dir:
            raise ValueError(
                f"Computed register path {path!r} escapes the project directory."
            )

    if os.path.isfile(new_path):
        return new_path

    if os.path.isfile(legacy_path):
        os.rename(legacy_path, new_path)
        logger.info(
            "Register filename migrated: %r → %r", legacy_filename, new_filename
        )
        return new_path

    raise FileNotFoundError(
        f"No register file found in {safe_dir!r}. "
        f"Expected {new_filename!r} or legacy {legacy_filename!r}."
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def new_register(project_number: str, project_name: str = "") -> dict[str, Any]:
    """Return a fresh empty register at the current SCHEMA_VERSION."""
    return {
        "schema_version": SCHEMA_VERSION,
        "project_number": project_number,
        "project_name": project_name,
        "current_phase": "IFA",
        "updated_at": _now_iso(),
        "drawings": [],
    }


def open_register(path: str) -> dict[str, Any]:
    """Read a register JSON file from disk, auto-migrating if necessary."""
    from core.migration import migrate_register  # local import to avoid circular

    if not os.path.isfile(path):
        raise FileNotFoundError(f"Register not found: {path}")
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    version = data.get("schema_version", 1)
    if version > SCHEMA_VERSION:
        raise ValueError(
            f"Register file is schema_version {version}; this version of DLM supports up to "
            f"{SCHEMA_VERSION}. Please update DLM to open this project."
        )
    if version < SCHEMA_VERSION:
        data = migrate_register(data)
        # Persist the migrated register back to disk.
        save_register(path, data)

    return data


def save_register(path: str, register: dict[str, Any]) -> None:
    """Write a register dict to disk as JSON, stamping updated_at."""
    register = dict(register)
    register["updated_at"] = _now_iso()
    register.setdefault("schema_version", SCHEMA_VERSION)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(register, fh, indent=2, ensure_ascii=False)


# ── Drawing helpers ───────────────────────────────────────────────────────

def current_revision(drawing: dict) -> dict | None:
    """Return the last entry in ``drawing["revisions"]``, or None."""
    revs = drawing.get("revisions", [])
    return revs[-1] if revs else None


def current_display_rev(drawing: dict) -> str:
    """Return a formatted display string for the current revision.

    Examples:
      - IFA Rev B at 60%  → ``"60% IFA Rev B"``
      - IFC Rev 1         → ``"IFC Rev 1"``
      - No revisions yet  → ``""``
    """
    rev = current_revision(drawing)
    if rev is None:
        return ""
    phase = rev.get("phase", "")
    rev_label = rev.get("rev", "")
    percent = rev.get("percent")
    if phase == "IFA" and percent is not None:
        return f"{percent}% IFA Rev {rev_label}"
    return f"{phase} Rev {rev_label}"


# ── Validation ────────────────────────────────────────────────────────────

_IFA_REV_RE = re.compile(r"^[A-Z]+$")
_NUMERIC_REV_RE = re.compile(r"^\d+$")


def validate_register(reg: dict) -> list[str]:
    """Return a list of validation warnings/errors; empty list if valid."""
    errors: list[str] = []

    version = reg.get("schema_version", 1)
    if version < SCHEMA_VERSION:
        errors.append(
            f"Register is schema_version {version}; current is {SCHEMA_VERSION}. "
            "Call migrate_register() before validating."
        )
        return errors

    drawings = reg.get("drawings", [])
    for i, drawing in enumerate(drawings):
        dn = drawing.get("drawing_number", f"drawing[{i}]")
        prefix = f"{dn}:"

        # Validate set
        set_val = drawing.get("set")
        if set_val not in VALID_SETS:
            errors.append(f"{prefix} invalid set '{set_val}'. Must be one of {sorted(VALID_SETS)}.")

        # Validate superseded — MUST be a bool if present (missing is OK,
        # treated as False on read).
        if "superseded" in drawing and not isinstance(drawing["superseded"], bool):
            errors.append(
                f"{prefix} 'superseded' must be a boolean (got {type(drawing['superseded']).__name__})."
            )

        # Validate revisions
        revisions = drawing.get("revisions", [])
        prev_date: str | None = None
        prev_phase: str | None = None
        numeric_series_started = False

        for j, rev_entry in enumerate(revisions):
            rev = rev_entry.get("rev", "")
            date = rev_entry.get("date", "")
            phase = rev_entry.get("phase", "")
            percent = rev_entry.get("percent")

            rev_prefix = f"{prefix} revision[{j}] (rev={rev!r})"

            # Phase validity
            if phase not in VALID_PHASES:
                errors.append(f"{rev_prefix}: invalid phase '{phase}'.")

            # Percent only valid for IFA
            if phase != "IFA" and percent is not None:
                errors.append(
                    f"{rev_prefix}: 'percent' must be null for phase '{phase}'."
                )

            # IFA → IFC transition: first IFC rev must be "0".
            # Check this BEFORE updating numeric_series_started below, otherwise
            # the guard is always satisfied and this branch is unreachable.
            if (
                prev_phase == "IFA"
                and phase == "IFC"
                and not numeric_series_started
                and rev != "0"
            ):
                errors.append(
                    f"{rev_prefix}: first IFC revision after IFA must be '0' (got '{rev}')."
                )

            # Rev label format (also updates numeric_series_started)
            if phase == "IFA":
                if not _IFA_REV_RE.match(rev):
                    errors.append(
                        f"{rev_prefix}: IFA revisions must be uppercase letters (got '{rev}')."
                    )
            elif phase in ("IFC", "IFR"):
                if not _NUMERIC_REV_RE.match(rev):
                    errors.append(
                        f"{rev_prefix}: IFC/IFR revisions must be digits (got '{rev}')."
                    )
                else:
                    numeric_series_started = True

            # Chronological order
            if prev_date and date and date < prev_date:
                errors.append(
                    f"{rev_prefix}: date '{date}' is before previous revision date '{prev_date}'."
                )

            prev_date = date or prev_date
            prev_phase = phase

    return errors
