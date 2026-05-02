"""Tests for core/project_config.py."""
from __future__ import annotations

import json
import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.project_config import resolve_paths


class TestResolvePaths:
    def test_relative_paths_join_to_marker_dir(self, tmp_path):
        marker_path = str(tmp_path / ".r3p-project.json")
        marker = {
            "paths": {
                "drawings_dir": "Drawings/Live",
                "pdfs_dir": "Drawings/PDF",
            }
        }
        resolved = resolve_paths(marker, marker_path)
        assert resolved["drawings_dir"] == os.path.normpath(
            os.path.join(str(tmp_path), "Drawings/Live")
        )
        assert resolved["pdfs_dir"] == os.path.normpath(
            os.path.join(str(tmp_path), "Drawings/PDF")
        )

    def test_absolute_paths_pass_through(self, tmp_path):
        marker_path = str(tmp_path / ".r3p-project.json")
        abs_path = os.path.abspath(os.sep + "etc" + os.sep + "config")
        marker = {"paths": {"some_dir": abs_path}}
        resolved = resolve_paths(marker, marker_path)
        assert resolved["some_dir"] == os.path.normpath(abs_path)

    def test_resolution_independent_of_cwd(self, tmp_path, monkeypatch):
        marker_path = str(tmp_path / ".r3p-project.json")
        marker = {"paths": {"drawings_dir": "Drawings/Live"}}

        # Change CWD to a totally unrelated directory before resolving.
        with tempfile.TemporaryDirectory() as other:
            monkeypatch.chdir(other)
            resolved = resolve_paths(marker, marker_path)

        # Still resolves under the marker's directory, not under `other`.
        assert resolved["drawings_dir"].startswith(str(tmp_path))

    def test_empty_paths_returns_empty_dict(self, tmp_path):
        marker_path = str(tmp_path / ".r3p-project.json")
        assert resolve_paths({}, marker_path) == {}
        assert resolve_paths({"paths": {}}, marker_path) == {}


class TestCreateProject:
    def test_marker_has_default_paths(self, tmp_path):
        from core.project_config import create_project, DEFAULT_PROJECT_PATHS

        marker = create_project(
            folder=str(tmp_path),
            project_number="R3P-25074",
            project_name="Test",
        )
        assert "drawings_dir" in marker["paths"]
        assert "pdfs_dir" in marker["paths"]
        assert "index_xlsx" in marker["paths"]
        assert marker["paths"]["drawings_dir"] == DEFAULT_PROJECT_PATHS["drawings_dir"]
        assert marker["paths"]["pdfs_dir"] == DEFAULT_PROJECT_PATHS["pdfs_dir"]

    def test_user_paths_override_defaults(self, tmp_path):
        from core.project_config import create_project

        marker = create_project(
            folder=str(tmp_path),
            project_number="R3P-25074",
            paths={"drawings_dir": "DWG", "index_xlsx": "Index/list.xlsx"},
        )
        assert marker["paths"]["drawings_dir"] == "DWG"
        assert marker["paths"]["index_xlsx"] == "Index/list.xlsx"
        # Untouched keys retain defaults.
        assert marker["paths"]["pdfs_dir"] == "Drawings/PDF"


class TestReadMarkerVersionGuard:
    def test_future_version_raises(self, tmp_path):
        from core.project_config import read_marker, MARKER_SCHEMA_VERSION

        marker_path = tmp_path / ".r3p-project.json"
        future_version = MARKER_SCHEMA_VERSION + 1
        marker_path.write_text(
            json.dumps({"schema_version": future_version, "project_number": "R3P-99999"}),
            encoding="utf-8",
        )
        with pytest.raises(ValueError, match=f"schema_version {future_version}") as exc_info:
            read_marker(str(marker_path))
        assert str(MARKER_SCHEMA_VERSION) in str(exc_info.value)
        assert "Please update DLM" in str(exc_info.value)

    def test_current_version_ok(self, tmp_path):
        from core.project_config import read_marker, MARKER_SCHEMA_VERSION

        marker_path = tmp_path / ".r3p-project.json"
        marker_path.write_text(
            json.dumps({"schema_version": MARKER_SCHEMA_VERSION, "project_number": "R3P-99999"}),
            encoding="utf-8",
        )
        marker = read_marker(str(marker_path))
        assert marker["project_number"] == "R3P-99999"

    def test_missing_version_defaults_to_1(self, tmp_path):
        from core.project_config import read_marker

        marker_path = tmp_path / ".r3p-project.json"
        marker_path.write_text(
            json.dumps({"project_number": "R3P-99999"}),
            encoding="utf-8",
        )
        # Should not raise; pre-versioning files are accepted as version 1.
        marker = read_marker(str(marker_path))
        assert marker["project_number"] == "R3P-99999"
