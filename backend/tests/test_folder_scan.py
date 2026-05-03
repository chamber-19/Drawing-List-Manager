"""Tests for core/folder_scan.py."""
from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.folder_scan import scan_drawings_folder, FolderScanResult


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _make_files(base: object, *names: str) -> None:
    """Write empty files relative to *base* (a pathlib.Path)."""
    for name in names:
        # Create intermediate directories if needed.
        target = base / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"")


# ─── Core functionality ───────────────────────────────────────────────────────


class TestFindsDwgFiles:
    def test_finds_dwg_files(self, tmp_path):
        """Folder with three .dwg files returns a drawings list of length 3."""
        _make_files(tmp_path, "A1-001.dwg", "A1-002.dwg", "A1-003.dwg")
        result = scan_drawings_folder(str(tmp_path))
        assert len(result["drawings"]) == 3

    def test_dwg_entry_has_expected_fields(self, tmp_path):
        _make_files(tmp_path, "E0-001.dwg")
        result = scan_drawings_folder(str(tmp_path))
        d = result["drawings"][0]
        assert d["filename"] == "E0-001.dwg"
        assert d["stem"] == "E0-001"
        assert os.path.isabs(d["path"])
        assert d["path"].endswith("E0-001.dwg")


class TestFindsPdfsInSubdir:
    def test_finds_pdfs_in_pdf_subdir(self, tmp_path):
        """Folder with pdf/ subdir containing PDFs returns pdfs correctly."""
        _make_files(tmp_path, "A1-001.dwg", "pdf/A1-001.pdf", "pdf/A1-002.pdf")
        result = scan_drawings_folder(str(tmp_path))
        assert result["pdf_dir_found"] is True
        assert len(result["pdfs"]) == 2

    def test_pdf_entry_has_expected_fields(self, tmp_path):
        _make_files(tmp_path, "pdf/E0-001.pdf")
        result = scan_drawings_folder(str(tmp_path))
        p = result["pdfs"][0]
        assert p["filename"] == "E0-001.pdf"
        assert p["stem"] == "E0-001"
        assert os.path.isabs(p["path"])


class TestMatchesByStem:
    def test_matched_pairs_correct(self, tmp_path):
        """Drawings with matching PDFs are paired; mismatches go to right buckets."""
        _make_files(
            tmp_path,
            "E0-001.dwg",   # has matching PDF
            "E0-002.dwg",   # no matching PDF
            "pdf/E0-001.pdf",
            "pdf/E0-003.pdf",  # orphan PDF (no matching drawing)
        )
        result = scan_drawings_folder(str(tmp_path))

        assert len(result["matched"]) == 1
        assert result["matched"][0]["drawing"]["stem"] == "E0-001"
        assert result["matched"][0]["pdf"]["stem"] == "E0-001"

        assert len(result["drawings_without_pdfs"]) == 1
        assert result["drawings_without_pdfs"][0]["stem"] == "E0-002"

        assert len(result["pdfs_without_drawings"]) == 1
        assert result["pdfs_without_drawings"][0]["stem"] == "E0-003"

    def test_case_insensitive_stem_matching(self, tmp_path):
        """Stem comparison is case-insensitive (E0-001 pairs with e0-001.pdf)."""
        _make_files(tmp_path, "E0-001.dwg", "pdf/e0-001.pdf")
        result = scan_drawings_folder(str(tmp_path))
        assert len(result["matched"]) == 1
        assert len(result["drawings_without_pdfs"]) == 0
        assert len(result["pdfs_without_drawings"]) == 0


class TestCaseInsensitivePdfDir:
    @pytest.mark.parametrize("dir_name", ["PDF", "Pdf", "PDFs", "pdf", "pdfs"])
    def test_pdf_dir_name_variants(self, tmp_path, dir_name):
        """PDF dir named PDF, Pdf, PDFs all work (case-insensitive directory match)."""
        _make_files(tmp_path, f"E0-001.dwg", f"{dir_name}/E0-001.pdf")
        result = scan_drawings_folder(str(tmp_path))
        assert result["pdf_dir_found"] is True
        assert len(result["pdfs"]) == 1


class TestNoPdfDir:
    def test_no_pdf_dir_returns_empty_pdfs(self, tmp_path):
        """Folder without a pdf/ subdir returns empty pdfs and pdf_dir_found=False."""
        _make_files(tmp_path, "E0-001.dwg", "E0-002.dwg")
        result = scan_drawings_folder(str(tmp_path))
        assert result["pdf_dir_found"] is False
        assert result["pdfs"] == []
        assert result["pdf_dir"] is None
        assert len(result["drawings_without_pdfs"]) == 2
        assert result["pdfs_without_drawings"] == []

    def test_no_pdf_dir_result_shape(self, tmp_path):
        """Result contains all expected keys even when pdf dir is absent."""
        result = scan_drawings_folder(str(tmp_path))
        for key in (
            "drawings_root", "pdf_dir", "pdf_dir_found",
            "drawings", "pdfs", "matched",
            "drawings_without_pdfs", "pdfs_without_drawings",
        ):
            assert key in result


class TestTopLevelOnly:
    def test_dwg_in_subdirectory_not_picked_up(self, tmp_path):
        """Drawings in subdirectories are NOT picked up (no recursive scan)."""
        _make_files(
            tmp_path,
            "root_level.dwg",
            "Archive/old.dwg",
            "Live/newer.dwg",
            "WIP/draft.dwg",
        )
        result = scan_drawings_folder(str(tmp_path))
        assert len(result["drawings"]) == 1
        assert result["drawings"][0]["filename"] == "root_level.dwg"

    def test_pdf_in_sub_subdir_not_picked_up(self, tmp_path):
        """PDFs in sub-sub-directories of pdf/ are not picked up."""
        _make_files(
            tmp_path,
            "pdf/top.pdf",
            "pdf/nested/deep.pdf",
        )
        result = scan_drawings_folder(str(tmp_path))
        assert len(result["pdfs"]) == 1
        assert result["pdfs"][0]["filename"] == "top.pdf"


class TestSkipsHiddenFiles:
    def test_hidden_dwg_not_in_results(self, tmp_path):
        """Hidden files (starting with '.') are not included in results."""
        _make_files(tmp_path, ".hidden.dwg", "visible.dwg")
        result = scan_drawings_folder(str(tmp_path))
        stems = [d["stem"] for d in result["drawings"]]
        assert "visible" in stems
        assert ".hidden" not in stems
        assert len(result["drawings"]) == 1

    def test_hidden_pdf_not_in_results(self, tmp_path):
        _make_files(tmp_path, "pdf/.hidden.pdf", "pdf/visible.pdf")
        result = scan_drawings_folder(str(tmp_path))
        assert len(result["pdfs"]) == 1
        assert result["pdfs"][0]["filename"] == "visible.pdf"


class TestMissingRootDirectory:
    def test_missing_drawings_root_returns_empty(self, tmp_path):
        """Missing drawings root returns all-empty lists and pdf_dir_found=False."""
        result = scan_drawings_folder(str(tmp_path / "nonexistent"))
        assert result["drawings"] == []
        assert result["pdfs"] == []
        assert result["pdf_dir_found"] is False
        assert result["matched"] == []
        assert result["drawings_without_pdfs"] == []
        assert result["pdfs_without_drawings"] == []

    def test_drawings_root_is_normalised_to_absolute(self, tmp_path):
        result = scan_drawings_folder(str(tmp_path))
        assert os.path.isabs(result["drawings_root"])


class TestExtensionFiltering:
    def test_non_dwg_files_not_included(self, tmp_path):
        """Only .dwg files are collected; other extensions are ignored."""
        _make_files(tmp_path, "drawing.pdf", "notes.txt", "archive.zip", "plan.dwg")
        result = scan_drawings_folder(str(tmp_path))
        assert len(result["drawings"]) == 1
        assert result["drawings"][0]["filename"] == "plan.dwg"

    def test_dwg_extension_case_insensitive(self, tmp_path):
        """Extension comparison is case-insensitive (.DWG, .Dwg, etc.)."""
        _make_files(tmp_path, "upper.DWG", "mixed.Dwg", "lower.dwg")
        result = scan_drawings_folder(str(tmp_path))
        assert len(result["drawings"]) == 3

    def test_pdf_extension_case_insensitive(self, tmp_path):
        """PDF extension comparison is case-insensitive (.PDF, .Pdf, etc.)."""
        _make_files(tmp_path, "pdf/upper.PDF", "pdf/mixed.Pdf", "pdf/lower.pdf")
        result = scan_drawings_folder(str(tmp_path))
        assert len(result["pdfs"]) == 3
