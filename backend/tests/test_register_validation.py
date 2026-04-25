"""Tests for validate_register() in core/register.py."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.register import validate_register


def _draw(revisions):
    """Build a single-drawing register with the given revisions."""
    return {
        "schema_version": 2,
        "project_number": "R3P-25074",
        "drawings": [{
            "drawing_number": "R3P-25074-E6-0001",
            "description": "TEST",
            "set": "P&C",
            "status": "IN DESIGN",
            "notes": None,
            "revisions": revisions,
        }],
    }


class TestIFAToIFCTransition:
    def test_first_ifc_rev_must_be_zero(self):
        reg = _draw([
            {"rev": "A", "date": "2025-10-17", "phase": "IFA", "percent": 30},
            {"rev": "1", "date": "2026-01-10", "phase": "IFC", "percent": None},
        ])
        errors = validate_register(reg)
        assert any("must be '0'" in e for e in errors), \
            f"Expected IFA→IFC transition error, got: {errors}"

    def test_first_ifc_rev_zero_passes(self):
        reg = _draw([
            {"rev": "A", "date": "2025-10-17", "phase": "IFA", "percent": 30},
            {"rev": "0", "date": "2026-01-10", "phase": "IFC", "percent": None},
        ])
        assert validate_register(reg) == []

    def test_subsequent_ifc_revs_increment_normally(self):
        reg = _draw([
            {"rev": "A", "date": "2025-10-17", "phase": "IFA", "percent": 30},
            {"rev": "0", "date": "2026-01-10", "phase": "IFC", "percent": None},
            {"rev": "1", "date": "2026-02-05", "phase": "IFC", "percent": None},
        ])
        assert validate_register(reg) == []


class TestPercentRule:
    def test_percent_on_ifc_errors(self):
        reg = _draw([
            {"rev": "0", "date": "2026-01-10", "phase": "IFC", "percent": 50},
        ])
        errors = validate_register(reg)
        assert any("must be null" in e for e in errors)

    def test_percent_on_ifa_is_fine(self):
        reg = _draw([
            {"rev": "A", "date": "2025-10-17", "phase": "IFA", "percent": 60},
        ])
        assert validate_register(reg) == []


class TestSetValidation:
    def test_invalid_set_errors(self):
        reg = _draw([])
        reg["drawings"][0]["set"] = "BOGUS"
        errors = validate_register(reg)
        assert any("invalid set" in e for e in errors)


class TestChronological:
    def test_dates_must_not_go_backwards(self):
        reg = _draw([
            {"rev": "A", "date": "2025-12-17", "phase": "IFA", "percent": 30},
            {"rev": "B", "date": "2025-10-15", "phase": "IFA", "percent": 60},
        ])
        errors = validate_register(reg)
        assert any("before previous revision date" in e for e in errors)


class TestIFAFormat:
    def test_lowercase_ifa_rev_errors(self):
        reg = _draw([
            {"rev": "a", "date": "2025-10-17", "phase": "IFA", "percent": 30},
        ])
        errors = validate_register(reg)
        assert any("uppercase letters" in e for e in errors)
