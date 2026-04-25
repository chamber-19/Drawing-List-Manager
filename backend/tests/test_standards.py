"""Tests for the standards catalogue (core/standards.py)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.standards import (
    find_band,
    get_type_spec,
    default_set_for_type,
)


class TestType0Bands:
    def test_seq_50_is_cover_page_drawing_index_band(self):
        band = find_band("E", "0", 50)
        assert band is not None
        assert band.label == "COVER PAGE, DRAWING INDEX"

    def test_seq_150_is_cable_schedule(self):
        assert find_band("E", "0", 150).label == "CABLE SCHEDULE"

    def test_seq_250_is_bill_of_material(self):
        assert find_band("E", "0", 250).label == "BILL OF MATERIAL"

    def test_reserved_zero_is_cover_page(self):
        spec = get_type_spec("E", "0")
        assert spec.reserved[0] == "Cover Page"
        assert spec.reserved[1] == "Drawing Index"


class TestType6Bands:
    def test_seq_50_is_sld(self):
        assert find_band("E", "6", 50).label == "SINGLE LINE DIAGRAMS"

    def test_seq_150_is_three_line(self):
        assert find_band("E", "6", 150).label == "THREE LINE DIAGRAMS"

    def test_seq_250_is_ac_schematics(self):
        assert find_band("E", "6", 250).label == "AC SCHEMATICS"

    def test_seq_350_is_dc_schematics(self):
        assert find_band("E", "6", 350).label == "DC SCHEMATICS"

    def test_seq_450_is_wiring(self):
        assert find_band("E", "6", 450).label == "WIRING DIAGRAMS"

    def test_seq_650_is_panel_schedules(self):
        assert find_band("E", "6", 650).label == "PANEL SCHEDULES"

    def test_seq_in_gap_returns_none(self):
        # 501-600 is a gap in Type 6 per the spec
        assert find_band("E", "6", 550) is None


class TestSetByType:
    def test_type_0_is_ambiguous(self):
        assert default_set_for_type("0") is None

    def test_types_1_through_5_are_physicals(self):
        for t in "12345":
            assert default_set_for_type(t) == "Physicals"

    def test_type_6_is_pc(self):
        assert default_set_for_type("6") == "P&C"


class TestUnknown:
    def test_unknown_discipline_returns_none(self):
        assert get_type_spec("Z", "0") is None

    def test_unknown_type_returns_none(self):
        assert get_type_spec("E", "X") is None
