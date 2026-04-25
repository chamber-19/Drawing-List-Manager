"""
core/standards.py — Pure data catalogue for R3P drawing type standards.

Mirrors R3P-SPEC-002 — Drafting & Design Standard. Zero IO, zero side
effects.

Structure:
  TYPES_<DISCIPLINE>: dict mapping type-digit (str) to a TypeSpec.

TypeSpec shape (NamedTuple):
  label:       str            # short human-readable name
  description: str            # fuller description
  bands:       list[Band]     # within-type sequence-number bands
  reserved:    dict[int, str] # specific reserved sequences (e.g. 0 -> "Cover Page")

Band shape (NamedTuple):
  start: int  # inclusive
  end:   int  # inclusive
  label: str  # band purpose, e.g. "POWER & CONTROL ROUTING PLANS"

Status: Type 0 and Type 6 fully filled as examples covering both ends of
the catalogue. Types 1-5, 7-9 are stubbed with `bands=[]` and a
`# TODO: Fill from R3P-SPEC-002 §X.Y` marker. Fill in a follow-up PR.
"""

from __future__ import annotations

from typing import NamedTuple


class Band(NamedTuple):
    start: int
    end: int
    label: str


class TypeSpec(NamedTuple):
    label: str
    description: str
    bands: list[Band]
    reserved: dict[int, str]


# ── Discipline E — Electrical ─────────────────────────────────────────────

TYPES_E: dict[str, TypeSpec] = {
    "0": TypeSpec(
        label="General",
        description="Symbols legend, notes, indexes, schedules.",
        bands=[
            Band(1, 100, "COVER PAGE, DRAWING INDEX"),
            Band(101, 200, "CABLE SCHEDULE"),
            Band(201, 300, "BILL OF MATERIAL"),
        ],
        reserved={0: "Cover Page", 1: "Drawing Index"},
    ),
    "1": TypeSpec(
        label="Plans",
        description="Horizontal views.",
        # TODO: Fill from R3P-SPEC-002 §1.2
        bands=[],
        reserved={0: "Reserved for XREF Plot Plan"},
    ),
    "2": TypeSpec(
        label="Elevations",
        description="Vertical views.",
        # TODO: Fill from R3P-SPEC-002 §1.3
        bands=[],
        reserved={},
    ),
    "3": TypeSpec(
        label="Sections",
        description="Sectional views, wall sections.",
        # TODO: Fill from R3P-SPEC-002 §1.4
        bands=[],
        reserved={},
    ),
    "4": TypeSpec(
        label="Large-Scale Views",
        description="Plans, elevations, stair sections, sections that are not details.",
        # TODO: Fill from R3P-SPEC-002 §1.5
        bands=[],
        reserved={},
    ),
    "5": TypeSpec(
        label="Details",
        description="Separated by discipline, then type.",
        # TODO: Fill from R3P-SPEC-002 §1.6
        bands=[],
        reserved={},
    ),
    "6": TypeSpec(
        label="Schedules and Diagrams",
        description="Separated in blocks of 100.",
        bands=[
            Band(1, 100, "SINGLE LINE DIAGRAMS"),
            Band(101, 200, "THREE LINE DIAGRAMS"),
            Band(201, 300, "AC SCHEMATICS"),
            Band(301, 400, "DC SCHEMATICS"),
            Band(401, 500, "WIRING DIAGRAMS"),
            Band(601, 700, "PANEL SCHEDULES"),
        ],
        reserved={},
    ),
    "7": TypeSpec(
        label="User Defined",
        description="Reserved for project-specific use.",
        bands=[],
        reserved={},
    ),
    "8": TypeSpec(
        label="User Defined",
        description="Reserved for project-specific use.",
        bands=[],
        reserved={},
    ),
    "9": TypeSpec(
        label="3D Representations",
        description="3D views and isometric drawings.",
        # TODO: Fill from R3P-SPEC-002 §1.10
        bands=[],
        reserved={},
    ),
}


# Auto-tag rule: type digit -> default `set` assignment.
# Type 0 is ambiguous (mixes P&C and Physicals depending on content) —
# the UI prompts the user. Types 1-5 are physical disciplines. Type 6 is P&C.
SET_BY_TYPE: dict[str, str | None] = {
    "0": None,
    "1": "Physicals",
    "2": "Physicals",
    "3": "Physicals",
    "4": "Physicals",
    "5": "Physicals",
    "6": "P&C",
    "7": None,
    "8": None,
    "9": "Physicals",
}


# ── Registry of all disciplines ───────────────────────────────────────────

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


def find_band(discipline: str, type_digit: str, seq: int) -> Band | None:
    """Return the Band a (discipline, type, seq) belongs to, or None."""
    spec = get_type_spec(discipline, type_digit)
    if spec is None:
        return None
    for band in spec.bands:
        if band.start <= seq <= band.end:
            return band
    return None


def default_set_for_type(type_digit: str) -> str | None:
    """Return the default ``set`` tag for a given type digit, or None if ambiguous."""
    return SET_BY_TYPE.get(type_digit)
