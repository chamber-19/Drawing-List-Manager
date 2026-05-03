"""Tests for register filename builder and legacy-migration helper."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.register import (
    REGISTER_LEGACY_FILENAME,
    build_register_filename,
    find_or_migrate_register,
    new_register,
    save_register,
)


class TestBuildRegisterFilename:
    def test_basic(self):
        result = build_register_filename("R3P-25074", "Substation Upgrade")
        assert result == "R3P-25074-Substation-Upgrade-DrawingIndex-Metadata.json"

    def test_sanitizes_special_chars(self):
        result = build_register_filename("R3P-99999", "A&B / C: Test!")
        # & → -, space → -, / → -, : → -, ! → -, collapsed runs → single -
        assert result == "R3P-99999-A-B-C-Test-DrawingIndex-Metadata.json"

    def test_sanitizes_spaces(self):
        result = build_register_filename("R3P-10000", "Hello World")
        assert result == "R3P-10000-Hello-World-DrawingIndex-Metadata.json"

    def test_empty_project_name_omits_segment(self):
        result = build_register_filename("R3P-25074", "")
        assert result == "R3P-25074-DrawingIndex-Metadata.json"

    def test_underscores_preserved(self):
        result = build_register_filename("R3P-25074", "My_Project")
        assert result == "R3P-25074-My_Project-DrawingIndex-Metadata.json"

    def test_collapses_runs_of_hyphens(self):
        result = build_register_filename("R3P-25074", "A  &  B")
        # "A  &  B" → "A--&--B" → after & replaced "A-----B" → collapsed "A-B"
        assert result == "R3P-25074-A-B-DrawingIndex-Metadata.json"


class TestFindOrMigrateRegister:
    def test_uses_new_filename_when_present(self, tmp_path):
        """New-pattern file exists → returned without renaming anything."""
        project_number = "R3P-25074"
        project_name = "Test Project"
        new_filename = build_register_filename(project_number, project_name)
        new_path = tmp_path / new_filename
        save_register(str(new_path), new_register(project_number, project_name))

        result = find_or_migrate_register(str(tmp_path), project_number, project_name)

        assert result == str(new_path)
        # Legacy file was never created, so no rename happened.
        legacy_path = tmp_path / f"{project_number}{REGISTER_LEGACY_FILENAME}"
        assert not legacy_path.exists()

    def test_renames_legacy_filename(self, tmp_path):
        """Legacy file exists but new-pattern does not → rename and return new path."""
        project_number = "R3P-25074"
        project_name = "Test Project"
        legacy_filename = f"{project_number}{REGISTER_LEGACY_FILENAME}"
        legacy_path = tmp_path / legacy_filename
        save_register(str(legacy_path), new_register(project_number, project_name))

        result = find_or_migrate_register(str(tmp_path), project_number, project_name)

        expected_filename = build_register_filename(project_number, project_name)
        expected_path = str(tmp_path / expected_filename)
        assert result == expected_path
        assert os.path.isfile(expected_path)
        assert not legacy_path.exists()

    def test_errors_when_neither_exists(self, tmp_path):
        """Neither new nor legacy file exists → FileNotFoundError."""
        with pytest.raises(FileNotFoundError, match="No register file found"):
            find_or_migrate_register(str(tmp_path), "R3P-25074", "Test Project")
