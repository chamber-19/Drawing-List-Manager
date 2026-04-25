"""
core/register.py — JSON register model + open/save helpers.

Register shape (schema_version 2):
{
  "schema_version": 2,
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
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from typing import Any


SCHEMA_VERSION = 2

VALID_SETS = {"P&C", "Physicals"}

VALID_PHASES = {"IFA", "IFC", "IFR", "IFB", "IFF", "IFRef"}

VALID_STATUSES = {
    "NOT CREATED YET",
    "IN DESIGN",
    "READY FOR DRAFTING",
    "READY FOR SUBMITTAL",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def new_register(project_number: str, project_name: str = "") -> dict[str, Any]:
    """Return a fresh empty register (schema_version 2)."""
    return {
        "schema_version": SCHEMA_VERSION,
        "project_number": project_number,
        "project_name": project_name,
        "current_phase": "IFA",
        "updated_at": _now_iso(),
        "drawings": [],
    }


def open_register(path: str) -> dict[str, Any]:
    """Read a .r3pdrawings.json file from disk, auto-migrating if necessary."""
    from core.migration import migrate_register  # local import to avoid circular

    if not os.path.isfile(path):
        raise FileNotFoundError(f"Register not found: {path}")
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    version = data.get("schema_version", 1)
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
