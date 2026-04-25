"""Tests for the drawing number parser (core/drawing_number.py)."""

from __future__ import annotations

import pytest
import sys
import os

# Ensure the backend package is on the path.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.drawing_number import parse, format, is_valid, ParsedDrawing, DrawingNumberError


class TestParse:
    def test_e0_parses_correctly(self):
        p = parse("R3P-25074-E0-0001")
        assert p.project == "25074"
        assert p.discipline == "E"
        assert p.type == "0"
        assert p.seq == "0001"

    def test_e1_parses_correctly(self):
        p = parse("R3P-25074-E1-0407")
        assert p.project == "25074"
        assert p.discipline == "E"
        assert p.type == "1"
        assert p.seq == "0407"
        # band is None / not yet implemented for Type 1
        assert p.band is None

    def test_e6_parses_correctly(self):
        p = parse("R3P-25074-E6-0001")
        assert p.project == "25074"
        assert p.discipline == "E"
        assert p.type == "6"
        assert p.seq == "0001"


class TestFormat:
    def test_roundtrip_e0(self):
        original = "R3P-25074-E0-0001"
        assert format(parse(original)) == original

    def test_roundtrip_e6(self):
        original = "R3P-25074-E6-0042"
        assert format(parse(original)) == original


class TestIsValid:
    def test_valid_numbers(self):
        assert is_valid("R3P-25074-E0-0001") is True
        assert is_valid("R3P-25074-E6-0042") is True
        assert is_valid("R3P-99999-A9-9999") is True

    def test_missing_r3p_prefix(self):
        assert is_valid("24001-E1-0001") is False

    def test_double_letter_type(self):
        assert is_valid("R3P-25074-EE-0001") is False

    def test_short_seq(self):
        assert is_valid("R3P-25074-E1-1") is False

    def test_extra_segment(self):
        assert is_valid("R3P-25074-E1-0001-EXTRA") is False


class TestErrors:
    def test_missing_r3p_prefix_raises(self):
        with pytest.raises(DrawingNumberError):
            parse("24001-E1-0001")

    def test_double_letter_type_raises(self):
        with pytest.raises(DrawingNumberError):
            parse("R3P-25074-EE-0001")

    def test_short_seq_raises(self):
        with pytest.raises(DrawingNumberError):
            parse("R3P-25074-E1-1")
