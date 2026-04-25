"""
core/standards.py — Pure data catalogue for R3P drawing type standards.

Zero IO — all data is defined inline.

Structure:
  TYPES_<DISCIPLINE>: dict mapping type-digit (str) to a TypeSpec dict.

TypeSpec shape:
  {
      "label":       str,           # short human-readable name
      "description": str,           # fuller description
      "series":      str,           # drawing number series band, e.g. "0001-0099"
      "notes":       str | None,    # advisory notes
  }

Status: one fully-filled type provided as an example (Type E6).
        Remaining types are stubbed with TODO comments — fill from R3P-SPEC-002.
"""

from __future__ import annotations

from typing import TypedDict


class TypeSpec(TypedDict):
    label: str
    description: str
    series: str
    notes: str | None


# ── Discipline E — Electrical ─────────────────────────────────────────────

TYPES_E: dict[str, TypeSpec] = {
    "0": {
        "label": "Drawing Index",
        "description": "Master drawing index / list for the discipline.",
        "series": "0001-0099",
        "notes": None,
    },
    "1": {
        # TODO: Fill from R3P-SPEC-002 §3.1
        "label": "TODO",
        "description": "TODO",
        "series": "TODO",
        "notes": None,
    },
    "2": {
        # TODO: Fill from R3P-SPEC-002 §3.2
        "label": "TODO",
        "description": "TODO",
        "series": "TODO",
        "notes": None,
    },
    "3": {
        # TODO: Fill from R3P-SPEC-002 §3.3
        "label": "TODO",
        "description": "TODO",
        "series": "TODO",
        "notes": None,
    },
    "4": {
        # TODO: Fill from R3P-SPEC-002 §3.4
        "label": "TODO",
        "description": "TODO",
        "series": "TODO",
        "notes": None,
    },
    "5": {
        # TODO: Fill from R3P-SPEC-002 §3.5
        "label": "TODO",
        "description": "TODO",
        "series": "TODO",
        "notes": None,
    },
    "6": {
        "label": "Single Line Diagram",
        "description": (
            "Overall and subsystem single line diagrams (SLDs) showing "
            "the high-voltage or medium-voltage switchgear arrangement, "
            "protection relay allocations, and interconnection."
        ),
        "series": "0001-0199",
        "notes": (
            "SLDs are always set P&C. Numbering within the 6-series is "
            "sequential per voltage level (HV first, then MV, then LV)."
        ),
    },
    "7": {
        # TODO: Fill from R3P-SPEC-002 §3.7
        "label": "TODO",
        "description": "TODO",
        "series": "TODO",
        "notes": None,
    },
    "8": {
        # TODO: Fill from R3P-SPEC-002 §3.8
        "label": "TODO",
        "description": "TODO",
        "series": "TODO",
        "notes": None,
    },
    "9": {
        # TODO: Fill from R3P-SPEC-002 §3.9
        "label": "TODO",
        "description": "TODO",
        "series": "TODO",
        "notes": None,
    },
}


# ── Registry of all disciplines ───────────────────────────────────────────
# Maps discipline letter to its type catalogue.

DISCIPLINES: dict[str, dict[str, TypeSpec]] = {
    "E": TYPES_E,
    # TODO: Add further disciplines (C, M, S, ...) from R3P-SPEC-002
}


def get_type_spec(discipline: str, type_digit: str) -> TypeSpec | None:
    """Return the TypeSpec for a given discipline + type digit, or None."""
    disc = DISCIPLINES.get(discipline.upper())
    if disc is None:
        return None
    return disc.get(type_digit)
