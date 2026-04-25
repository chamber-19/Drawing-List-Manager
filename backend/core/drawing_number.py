"""
core/drawing_number.py — Parse, validate, and format R3P drawing numbers.

Drawing number format:
  ``R3P-<project>-<discipline><type>-<seq>``

  - ``project``    — 5-digit project number (e.g. ``25074``)
  - ``discipline`` — single uppercase letter (e.g. ``E``)
  - ``type``       — single digit (0-9)
  - ``seq``        — zero-padded 4-digit sequence number (e.g. ``0001``)

Examples:
  ``R3P-25074-E0-0001``   Drawing Index
  ``R3P-25074-E6-0042``   SLD sheet 42
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional


_PATTERN = re.compile(
    r"^R3P-(?P<project>\d+)-(?P<discipline>[A-Z])(?P<type>\d)-(?P<seq>\d{4})$"
)


class DrawingNumberError(ValueError):
    """Raised when a drawing number string does not conform to the R3P format."""


@dataclass(frozen=True)
class ParsedDrawing:
    """Structured representation of a parsed R3P drawing number."""

    project: str       # e.g. "25074"
    discipline: str    # e.g. "E"
    type: str          # e.g. "6"
    seq: str           # e.g. "0042" (zero-padded)
    band: Optional[str] = None  # reserved for future band lookup from standards


def parse(drawing_number: str) -> ParsedDrawing:
    """Parse an R3P drawing number string into a :class:`ParsedDrawing`.

    Raises :class:`DrawingNumberError` if the string does not match the format.
    """
    m = _PATTERN.match(drawing_number.strip())
    if not m:
        raise DrawingNumberError(
            f"Invalid R3P drawing number: {drawing_number!r}. "
            f"Expected format: R3P-<project>-<Discipline><type>-<seq> "
            f"(e.g. R3P-25074-E6-0001)."
        )
    return ParsedDrawing(
        project=m.group("project"),
        discipline=m.group("discipline"),
        type=m.group("type"),
        seq=m.group("seq"),
    )


def format(parsed: ParsedDrawing) -> str:
    """Reconstruct the canonical drawing number string from a :class:`ParsedDrawing`."""
    return f"R3P-{parsed.project}-{parsed.discipline}{parsed.type}-{parsed.seq}"


def is_valid(drawing_number: str) -> bool:
    """Return ``True`` if *drawing_number* conforms to the R3P format."""
    return bool(_PATTERN.match(drawing_number.strip()))
