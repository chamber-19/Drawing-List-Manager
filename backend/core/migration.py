"""
core/migration.py — Upgrade legacy register files to the current schema.

Supported migrations:
  v1 → v2:
    - Flatten sets[].drawings[] into a single drawings[] list, with each
      drawing's ``set`` field carrying the parent set name.
    - Drop sets {"SUB", "BESS"} entirely, with contents re-classified:
        * Type 1-5 (discipline character 1-5) → "Physicals"
        * Type 6   (discipline character 6)   → "P&C"
        * Type 0   or unrecognised             → default "P&C" with a note
    - Convert each revision from {"rev","date"} to
      {"rev","date","phase","percent"}. Default phase: "IFA" if rev is a
      letter, "IFC" if rev is a digit.  percent: None.
    - Add "current_phase": "IFA" to the top-level register.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any


# Drawing number pattern to extract the type digit.
# e.g. R3P-25074-E6-0001  → discipline="E", type_digit="6"
_DRAW_NUM_RE = re.compile(
    r"^R3P-\d+-[A-Za-z](?P<type>\d)-\d{4}$", re.IGNORECASE
)

# Set names that are kept as-is (already in the v2 vocabulary).
_KEEP_SETS = {"P&C", "Physicals"}

# Type digit → set assignment for drawings migrating out of SUB / BESS.
# Types 1-5 are physical/civil disciplines; type 6 is P&C (electrical).
_TYPE_TO_SET: dict[str, str] = {
    "1": "Physicals",
    "2": "Physicals",
    "3": "Physicals",
    "4": "Physicals",
    "5": "Physicals",
    "6": "P&C",
}

_IFA_REV_RE = re.compile(r"^[A-Z]+$")
_NUMERIC_REV_RE = re.compile(r"^\d+$")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _infer_set(drawing_number: str, fallback_set: str) -> tuple[str, str | None]:
    """Return (target_set, warning_note) for a drawing being migrated.

    ``fallback_set`` is the v1 set name (e.g. "SUB" or "BESS") used when the
    drawing number doesn't match the expected pattern.
    """
    m = _DRAW_NUM_RE.match(drawing_number)
    if m:
        t = m.group("type")
        target = _TYPE_TO_SET.get(t)
        if target:
            return target, None
    # Type 0 or unrecognised — default to P&C with a flag.
    note = (
        f"[MIGRATED FROM {fallback_set}] Manual classification required — "
        "could not determine set from drawing number."
    )
    return "P&C", note


def _upgrade_revision(rev_entry: dict[str, Any]) -> dict[str, Any]:
    """Upgrade a v1 revision ``{"rev", "date"}`` to v2 shape."""
    rev = rev_entry.get("rev", "")
    date = rev_entry.get("date", "")

    # Infer phase from revision label.
    if _IFA_REV_RE.match(rev):
        phase = "IFA"
    elif _NUMERIC_REV_RE.match(rev):
        phase = "IFC"
    else:
        phase = "IFA"  # safe default for unexpected formats

    return {
        "rev": rev,
        "date": date,
        "phase": phase,
        "percent": None,
    }


def _migrate_v1_to_v2(data: dict[str, Any]) -> dict[str, Any]:
    """Return a new dict upgraded from schema_version 1 to 2."""
    drawings: list[dict[str, Any]] = []

    for set_obj in data.get("sets", []):
        set_name: str = set_obj.get("name", "")
        is_legacy = set_name not in _KEEP_SETS  # SUB, BESS, etc.

        for drawing in set_obj.get("drawings", []):
            draw_num = drawing.get("drawing_number", "")

            if set_name in _KEEP_SETS:
                target_set = set_name
                extra_note = None
            else:
                target_set, extra_note = _infer_set(draw_num, set_name)

            # Carry forward any existing notes, appending migration note if needed.
            existing_notes = drawing.get("notes") or ""
            if extra_note:
                notes: str | None = (
                    f"{existing_notes}\n{extra_note}".strip()
                    if existing_notes
                    else extra_note
                )
            else:
                notes = drawing.get("notes")

            upgraded_revisions = [
                _upgrade_revision(r) for r in drawing.get("revisions", [])
            ]

            drawings.append(
                {
                    "drawing_number": draw_num,
                    "description": drawing.get("description", ""),
                    "set": target_set,
                    "status": drawing.get("status", "NOT CREATED YET"),
                    "notes": notes,
                    "revisions": upgraded_revisions,
                }
            )

    return {
        "schema_version": 2,
        "project_number": data.get("project_number", ""),
        "project_name": data.get("project_name", ""),
        "current_phase": "IFA",
        "updated_at": _now_iso(),
        "drawings": drawings,
    }


# ── Public API ────────────────────────────────────────────────────────────

def migrate_register(data: dict[str, Any]) -> dict[str, Any]:
    """Upgrade a register dict to the current SCHEMA_VERSION.

    Migrations applied:
      v1 → v2:
        - Flatten sets[].drawings[] into a single drawings[] list, with each
          drawing's ``set`` field carrying the parent set name.
        - Drop sets {"SUB", "BESS"} entirely (their contents merge into
          "P&C" and "Physicals" by inference: type 1-5 → Physicals,
          type 6 → P&C, type 0 → require manual classification, default
          to "P&C" with a flag in ``notes``).
        - Convert each revision from {"rev","date"} to
          {"rev","date","phase","percent"}. Default phase: "IFA" if rev is
          a letter, "IFC" if rev is a digit.  percent: None.

    Returns a *new* dict (does not mutate ``data``).
    """
    version = data.get("schema_version", 1)

    if version == 1:
        data = _migrate_v1_to_v2(data)
        version = 2

    # Future migrations would be chained here:
    # if version == 2:
    #     data = _migrate_v2_to_v3(data)
    #     version = 3

    return data
