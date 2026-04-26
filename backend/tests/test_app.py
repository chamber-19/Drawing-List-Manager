"""Tests for backend FastAPI routes (backend/app.py)."""

from __future__ import annotations

import json
import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient

import app as app_module  # noqa: E402
from core.project_config import MARKER_FILENAME  # noqa: E402
from core.register import new_register, save_register  # noqa: E402


@pytest.fixture()
def client():
    return TestClient(app_module.app)


@pytest.fixture()
def project(tmp_path):
    """Create a real project on disk and return (marker_path, register_path)."""
    project_number = "R3P-25074"
    register_filename = f"{project_number}.r3pdrawings.json"
    register_path = os.path.join(tmp_path, register_filename)
    save_register(register_path, new_register(project_number, "Test"))

    marker = {
        "schema_version": 1,
        "project_number": project_number,
        "project_name": "Test",
        "register_file": register_filename,
        "paths": {"drawings_dir": "Drawings/Live", "pdfs_dir": "Drawings/PDF", "index_xlsx": ""},
    }
    marker_path = os.path.join(tmp_path, MARKER_FILENAME)
    with open(marker_path, "w", encoding="utf-8") as fh:
        json.dump(marker, fh)
    return marker_path, register_path


class TestSaveValidation:
    def test_invalid_set_returns_400(self, client, project):
        marker_path, _ = project
        bad = {
            "schema_version": 3,
            "project_number": "R3P-25074",
            "project_name": "Test",
            "current_phase": "IFA",
            "drawings": [{
                "drawing_number": "R3P-25074-E6-0001",
                "description": "OOPS",
                "set": "BOGUS",
                "status": "IN DESIGN",
                "notes": None,
                "superseded": False,
                "revisions": [],
            }],
        }
        resp = client.post(
            "/api/register/save",
            json={"marker_path": marker_path, "register": bad},
        )
        assert resp.status_code == 400, resp.text
        body = resp.json()
        # FastAPI wraps `detail` as-is for HTTPException with dict detail.
        detail = body["detail"]
        assert "errors" in detail
        assert any("invalid set" in e for e in detail["errors"])

    def test_invalid_register_does_not_overwrite_file(self, client, project):
        marker_path, register_path = project
        before = open(register_path, "r", encoding="utf-8").read()
        bad = {
            "schema_version": 3,
            "project_number": "R3P-25074",
            "current_phase": "IFA",
            "drawings": [{
                "drawing_number": "R3P-25074-E6-0001",
                "description": "OOPS",
                "set": "BOGUS",
                "status": "IN DESIGN",
                "notes": None,
                "superseded": False,
                "revisions": [],
            }],
        }
        client.post(
            "/api/register/save",
            json={"marker_path": marker_path, "register": bad},
        )
        after = open(register_path, "r", encoding="utf-8").read()
        assert before == after

    def test_save_strips_parsed_fields(self, client, project):
        marker_path, register_path = project
        good = {
            "schema_version": 3,
            "project_number": "R3P-25074",
            "project_name": "Test",
            "current_phase": "IFA",
            "drawings": [{
                "drawing_number": "R3P-25074-E6-0001",
                "description": "FINE",
                "set": "P&C",
                "status": "IN DESIGN",
                "notes": None,
                "superseded": False,
                "revisions": [],
                "_parsed": {"discipline": "E", "type_digit": "6", "seq": 1, "band": None},
            }],
        }
        resp = client.post(
            "/api/register/save",
            json={"marker_path": marker_path, "register": good},
        )
        assert resp.status_code == 200, resp.text
        with open(register_path, "r", encoding="utf-8") as fh:
            saved = json.load(fh)
        for d in saved["drawings"]:
            assert "_parsed" not in d
