"""Tests for schema migration (core/migration.py)."""

from __future__ import annotations

import json
import os
import sys

import pytest

# Ensure the backend package is on the path.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.migration import migrate_register

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def load_fixture(name: str) -> dict:
    with open(os.path.join(FIXTURES_DIR, name), "r", encoding="utf-8") as fh:
        return json.load(fh)


class TestMigrateV1ToV2:
    def test_schema_version_bumped(self):
        v1 = load_fixture("sample_v1_register.json")
        v2 = migrate_register(v1)
        # Migration chains v1 → v2 → v3 (current).
        assert v2["schema_version"] == 3

    def test_drawings_flattened(self):
        v1 = load_fixture("sample_v1_register.json")
        v2 = migrate_register(v1)
        assert "drawings" in v2
        assert "sets" not in v2

    def test_drawing_count(self):
        v1 = load_fixture("sample_v1_register.json")
        # v1 has 4 drawings across P&C, Physicals, and SUB
        v2 = migrate_register(v1)
        assert len(v2["drawings"]) == 4

    def test_set_field_on_drawings(self):
        v1 = load_fixture("sample_v1_register.json")
        v2 = migrate_register(v1)
        sets_found = {d["set"] for d in v2["drawings"]}
        # P&C and Physicals kept; SUB's E1 drawing inferred to Physicals
        assert sets_found.issubset({"P&C", "Physicals"})

    def test_sub_drawing_mapped_to_physicals(self):
        v1 = load_fixture("sample_v1_register.json")
        v2 = migrate_register(v1)
        sub_drawing = next(
            d for d in v2["drawings"]
            if d["drawing_number"] == "R3P-25074-E1-0050"
        )
        assert sub_drawing["set"] == "Physicals"

    def test_revisions_upgraded_with_phase(self):
        v1 = load_fixture("sample_v1_register.json")
        v2 = migrate_register(v1)
        e6_0001 = next(
            d for d in v2["drawings"]
            if d["drawing_number"] == "R3P-25074-E6-0001"
        )
        revisions = e6_0001["revisions"]
        assert len(revisions) == 5
        # Letter revs → IFA
        assert revisions[0]["phase"] == "IFA"
        assert revisions[1]["phase"] == "IFA"
        assert revisions[2]["phase"] == "IFA"
        # Digit revs → IFC
        assert revisions[3]["phase"] == "IFC"
        assert revisions[4]["phase"] == "IFC"

    def test_revisions_have_percent_none(self):
        v1 = load_fixture("sample_v1_register.json")
        v2 = migrate_register(v1)
        for drawing in v2["drawings"]:
            for rev in drawing["revisions"]:
                assert "percent" in rev
                assert rev["percent"] is None

    def test_current_phase_added(self):
        v1 = load_fixture("sample_v1_register.json")
        v2 = migrate_register(v1)
        assert v2.get("current_phase") == "IFA"

    def test_project_fields_preserved(self):
        v1 = load_fixture("sample_v1_register.json")
        v2 = migrate_register(v1)
        assert v2["project_number"] == "R3P-25074"
        assert v2["project_name"] == "Sample Project"

    def test_idempotent_on_v2(self):
        """migrate_register on a v2 register chains through to v3."""
        v2_original = load_fixture("sample_v2_register.json")
        result = migrate_register(v2_original)
        # v2 input now chains to v3 (current).
        assert result["schema_version"] == 3
        # drawing count unchanged
        assert len(result["drawings"]) == len(v2_original["drawings"])

    def test_fixture_match(self):
        """Migrated v1 fixture must equal the v2 fixture's drawings (ignoring schema bump to v3)."""
        v1 = load_fixture("sample_v1_register.json")
        v2_expected = load_fixture("sample_v2_register.json")
        v2_actual = migrate_register(v1)

        # Normalise updated_at before comparison (migration stamps the current time).
        v2_actual.pop("updated_at", None)
        v2_expected.pop("updated_at", None)

        # Migration chains v1 → v2 → v3 (current).
        assert v2_actual["schema_version"] == 3
        assert v2_actual["project_number"] == v2_expected["project_number"]
        assert v2_actual["current_phase"] == v2_expected["current_phase"]

        # Compare drawings by drawing_number (order may differ).
        actual_map = {d["drawing_number"]: d for d in v2_actual["drawings"]}
        expected_map = {d["drawing_number"]: d for d in v2_expected["drawings"]}
        assert set(actual_map.keys()) == set(expected_map.keys())

        for dn, expected_d in expected_map.items():
            actual_d = actual_map[dn]
            assert actual_d["set"] == expected_d["set"], f"{dn}: set mismatch"
            assert actual_d["status"] == expected_d["status"], f"{dn}: status mismatch"
            assert len(actual_d["revisions"]) == len(expected_d["revisions"]), f"{dn}: revision count mismatch"
            for i, (a_rev, e_rev) in enumerate(
                zip(actual_d["revisions"], expected_d["revisions"])
            ):
                assert a_rev["rev"] == e_rev["rev"], f"{dn} rev[{i}]: rev mismatch"
                assert a_rev["phase"] == e_rev["phase"], f"{dn} rev[{i}]: phase mismatch"


class TestMigrateV2ToV3:
    def test_superseded_added_to_all_drawings(self):
        v2 = load_fixture("sample_v2_register.json")
        v3 = migrate_register(v2)
        assert v3["schema_version"] == 3
        for d in v3["drawings"]:
            assert d.get("superseded") is False

    def test_existing_superseded_field_preserved(self):
        v2 = load_fixture("sample_v2_register.json")
        # Pre-flag one drawing as superseded.
        v2["drawings"][0]["superseded"] = True
        v3 = migrate_register(v2)
        assert v3["drawings"][0]["superseded"] is True
        # Other drawings still get the default False.
        for d in v3["drawings"][1:]:
            assert d["superseded"] is False

    def test_idempotent_on_v3(self):
        v3_in = load_fixture("sample_v3_register.json")
        v3_out = migrate_register(v3_in)
        assert v3_out["schema_version"] == 3
        assert len(v3_out["drawings"]) == len(v3_in["drawings"])
        for d in v3_out["drawings"]:
            assert d["superseded"] is False

    def test_chain_v1_to_v3(self):
        """v1 fixture migrates cleanly through the chain to v3."""
        v1 = load_fixture("sample_v1_register.json")
        v3 = migrate_register(v1)
        assert v3["schema_version"] == 3
        # Every drawing in the migrated register has superseded: False.
        for d in v3["drawings"]:
            assert d.get("superseded") is False
            # Drawings still have the v2-introduced set/status fields.
            assert d["set"] in {"P&C", "Physicals"}

    def test_fixture_match_v3(self):
        """Migrated v2 fixture must equal the v3 fixture (modulo updated_at)."""
        v2 = load_fixture("sample_v2_register.json")
        v3_expected = load_fixture("sample_v3_register.json")
        v3_actual = migrate_register(v2)

        v3_actual.pop("updated_at", None)
        v3_expected.pop("updated_at", None)

        assert v3_actual["schema_version"] == v3_expected["schema_version"]
        actual_map = {d["drawing_number"]: d for d in v3_actual["drawings"]}
        expected_map = {d["drawing_number"]: d for d in v3_expected["drawings"]}
        assert set(actual_map.keys()) == set(expected_map.keys())
        for dn, expected_d in expected_map.items():
            actual_d = actual_map[dn]
            assert actual_d["superseded"] == expected_d["superseded"], f"{dn}: superseded mismatch"
            assert actual_d["set"] == expected_d["set"], f"{dn}: set mismatch"
            assert actual_d["status"] == expected_d["status"], f"{dn}: status mismatch"
