"""Tests for core/project_scan.py."""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.project_scan import scan_project, _scan_dir


def _make_project(tmp_path, register_drawings, dwg_files, pdf_files):
    """Build a project layout on disk and return (marker, marker_path, register)."""
    drawings_dir = tmp_path / "Drawings" / "Live"
    pdfs_dir = tmp_path / "Drawings" / "PDF"
    drawings_dir.mkdir(parents=True)
    pdfs_dir.mkdir(parents=True)

    for name in dwg_files:
        (drawings_dir / name).write_bytes(b"")
    for name in pdf_files:
        (pdfs_dir / name).write_bytes(b"")

    marker = {
        "schema_version": 1,
        "project_number": "R3P-25074",
        "project_name": "Test",
        "register_file": "register.json",
        "paths": {
            "drawings_dir": "Drawings/Live",
            "pdfs_dir": "Drawings/PDF",
            "index_xlsx": "",
        },
    }
    marker_path = str(tmp_path / ".r3p-project.json")
    with open(marker_path, "w") as fh:
        json.dump(marker, fh)

    register = {
        "schema_version": 2,
        "project_number": "R3P-25074",
        "drawings": register_drawings,
    }
    return marker, marker_path, register


class TestFilenameParsing:
    def test_clean_dwg_filename(self, tmp_path):
        (tmp_path / "R3P-25074-E1-0301.dwg").write_bytes(b"")
        files = _scan_dir(str(tmp_path), "dwg")
        assert len(files) == 1
        assert files[0]["drawing_number"] == "R3P-25074-E1-0301"
        assert files[0]["rev_label"] is None
        assert files[0]["extension"] == "dwg"

    def test_filename_with_rev_suffix(self, tmp_path):
        (tmp_path / "R3P-25074-E1-0301_RevB.pdf").write_bytes(b"")
        files = _scan_dir(str(tmp_path), "pdf")
        assert files[0]["drawing_number"] == "R3P-25074-E1-0301"
        assert files[0]["rev_label"] == "B"

    def test_filename_with_numeric_rev_suffix(self, tmp_path):
        (tmp_path / "R3P-25074-E6-0001_Rev0.pdf").write_bytes(b"")
        files = _scan_dir(str(tmp_path), "pdf")
        assert files[0]["drawing_number"] == "R3P-25074-E6-0001"
        assert files[0]["rev_label"] == "0"

    def test_unparseable_filename_kept_as_orphan(self, tmp_path):
        (tmp_path / "random_notes.dwg").write_bytes(b"")
        files = _scan_dir(str(tmp_path), "dwg")
        assert len(files) == 1
        assert files[0]["drawing_number"] == ""

    def test_wrong_extension_skipped(self, tmp_path):
        (tmp_path / "R3P-25074-E1-0301.txt").write_bytes(b"")
        files = _scan_dir(str(tmp_path), "dwg")
        assert files == []

    def test_missing_directory_returns_empty(self, tmp_path):
        files = _scan_dir(str(tmp_path / "nonexistent"), "dwg")
        assert files == []


class TestMissingDwg:
    def test_register_drawing_with_no_dwg_is_missing(self, tmp_path):
        register_drawings = [{
            "drawing_number": "R3P-25074-E1-0308",
            "description": "CT Routing — DC Yard",
            "set": "Physicals",
            "status": "NOT CREATED YET",
            "notes": None,
            "revisions": [],
        }]
        marker, mp, reg = _make_project(tmp_path, register_drawings, [], [])
        result = scan_project(marker, mp, reg)
        assert len(result["missing_dwg"]) == 1
        assert result["missing_dwg"][0]["drawing_number"] == "R3P-25074-E1-0308"
        assert result["missing_dwg"][0]["status"] == "NOT CREATED YET"
        assert result["missing_dwg"][0]["set"] == "Physicals"


class TestOrphans:
    def test_dwg_not_in_register_is_orphan(self, tmp_path):
        marker, mp, reg = _make_project(
            tmp_path,
            register_drawings=[],
            dwg_files=["R3P-25074-E5-0203.dwg"],
            pdf_files=[],
        )
        result = scan_project(marker, mp, reg)
        assert len(result["orphan_dwg"]) == 1
        assert result["orphan_dwg"][0]["drawing_number"] == "R3P-25074-E5-0203"

    def test_unparseable_filename_is_orphan_with_empty_dn(self, tmp_path):
        marker, mp, reg = _make_project(
            tmp_path,
            register_drawings=[],
            dwg_files=["random.dwg"],
            pdf_files=[],
        )
        result = scan_project(marker, mp, reg)
        assert len(result["orphan_dwg"]) == 1
        assert result["orphan_dwg"][0]["drawing_number"] == ""
        assert result["orphan_dwg"][0]["filename"] == "random.dwg"

    def test_pdf_not_in_register_is_orphan(self, tmp_path):
        marker, mp, reg = _make_project(
            tmp_path,
            register_drawings=[],
            dwg_files=[],
            pdf_files=["R3P-25074-E5-0203_RevA.pdf"],
        )
        result = scan_project(marker, mp, reg)
        assert len(result["orphan_pdf"]) == 1
        assert result["orphan_pdf"][0]["drawing_number"] == "R3P-25074-E5-0203"


class TestStalePdf:
    def test_pdf_rev_behind_register_rev(self, tmp_path):
        register_drawings = [{
            "drawing_number": "R3P-25074-E1-0301",
            "description": "CT Routing — Sub Yard",
            "set": "Physicals",
            "status": "READY FOR SUBMITTAL",
            "notes": None,
            "revisions": [
                {"rev": "A", "date": "2025-10-17", "phase": "IFA", "percent": 30},
                {"rev": "B", "date": "2025-11-15", "phase": "IFA", "percent": 60},
            ],
        }]
        marker, mp, reg = _make_project(
            tmp_path,
            register_drawings,
            dwg_files=["R3P-25074-E1-0301_RevB.dwg"],
            pdf_files=["R3P-25074-E1-0301_RevA.pdf"],
        )
        result = scan_project(marker, mp, reg)
        assert len(result["stale_pdf"]) == 1
        s = result["stale_pdf"][0]
        assert s["register_rev"] == "B"
        assert s["pdf_rev"] == "A"
        assert s["dwg_rev"] == "B"

    def test_pdf_matching_register_rev_not_stale(self, tmp_path):
        register_drawings = [{
            "drawing_number": "R3P-25074-E1-0301",
            "description": "CT Routing — Sub Yard",
            "set": "Physicals",
            "status": "READY FOR SUBMITTAL",
            "notes": None,
            "revisions": [
                {"rev": "B", "date": "2025-11-15", "phase": "IFA", "percent": 60},
            ],
        }]
        marker, mp, reg = _make_project(
            tmp_path,
            register_drawings,
            dwg_files=["R3P-25074-E1-0301_RevB.dwg"],
            pdf_files=["R3P-25074-E1-0301_RevB.pdf"],
        )
        result = scan_project(marker, mp, reg)
        assert result["stale_pdf"] == []

    def test_drawing_with_no_revisions_skipped(self, tmp_path):
        register_drawings = [{
            "drawing_number": "R3P-25074-E1-0308",
            "description": "CT Routing — DC Yard",
            "set": "Physicals",
            "status": "NOT CREATED YET",
            "notes": None,
            "revisions": [],
        }]
        marker, mp, reg = _make_project(
            tmp_path,
            register_drawings,
            dwg_files=[],
            pdf_files=[],
        )
        result = scan_project(marker, mp, reg)
        assert result["stale_pdf"] == []


class TestScanResultShape:
    def test_returns_all_expected_keys(self, tmp_path):
        marker, mp, reg = _make_project(tmp_path, [], [], [])
        result = scan_project(marker, mp, reg)
        for key in (
            "scanned_at", "drawings_dir", "pdfs_dir",
            "dwg_files", "pdf_files",
            "missing_dwg", "orphan_dwg", "orphan_pdf", "stale_pdf",
        ):
            assert key in result
