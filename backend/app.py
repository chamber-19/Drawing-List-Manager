"""
R3P Drawing List Manager — Backend API

Routes:
    GET  /api/health                    Health check
    POST /api/project/create            Create new project folder + marker
    POST /api/project/open              Read project marker + register
    POST /api/project/scan              Diff register against on-disk DWG/PDF files
    GET  /api/project/recent            Return recent-projects list
    POST /api/register/save             Write a register to disk + regenerate Excel
    POST /api/register/import-excel     One-time legacy MDL import
    GET  /api/register/validate         Validate register, return warnings

Run:
    uvicorn app:app --reload --port 8001
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any

from core.register import open_register, save_register, validate_register, find_or_migrate_register
from core.excel_import import import_excel
from core.excel_export import export_full
from core.project_config import (
    create_project,
    read_marker,
    add_recent,
    list_recent,
)
from core.project_scan import scan_project
from core.drawing_number import parse as parse_drawing_number, DrawingNumberError
from core.standards import find_band


# ─── App Setup ────────────────────────────────────────────────

app = FastAPI(
    title="R3P Drawing List Manager",
    version="1.0.0",
    description="Backend API for the ROOT3POWER Drawing List Manager",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ─────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ─── Request / Response Models ────────────────────────────────

class CreateProjectRequest(BaseModel):
    folder: str
    project_number: str
    project_name: str = ""
    paths: dict[str, str] = {}


class OpenProjectRequest(BaseModel):
    marker_path: str


class ScanProjectRequest(BaseModel):
    marker_path: str


class SaveRegisterRequest(BaseModel):
    marker_path: str
    register: dict[str, Any]


class ImportExcelRequest(BaseModel):
    marker_path: str
    xlsx_path: str


# ─── Project Endpoints ────────────────────────────────────────

@app.post("/api/project/create")
def api_create_project(req: CreateProjectRequest):
    try:
        marker = create_project(
            folder=req.folder,
            project_number=req.project_number,
            project_name=req.project_name,
            paths=req.paths or {},
        )
        from core.project_config import MARKER_FILENAME
        marker_path = os.path.abspath(os.path.join(req.folder, MARKER_FILENAME))
        return {"success": True, "marker": marker, "marker_path": marker_path}
    except FileExistsError as e:
        raise HTTPException(409, str(e))
    except Exception as e:
        raise HTTPException(500, f"Failed to create project: {e}")


@app.post("/api/project/open")
def api_open_project(req: OpenProjectRequest):
    try:
        marker = read_marker(req.marker_path)
        project_dir = os.path.dirname(os.path.abspath(req.marker_path))
        register_path = find_or_migrate_register(
            project_dir,
            marker.get("project_number", ""),
            marker.get("project_name", ""),
        )
        register = open_register(register_path)
        # NOTE: mutates `register` in place — adds a transient `_parsed`
        # field to each drawing for view-only consumption.
        _enrich_drawings_with_parsed(register)
        add_recent(req.marker_path)
        return {
            "success": True,
            "marker": marker,
            "marker_path": os.path.abspath(req.marker_path),
            "register": register,
        }
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Failed to open project: {e}")


@app.post("/api/project/scan")
def api_scan_project(req: ScanProjectRequest):
    """Walk the project's configured directories and diff against register."""
    try:
        marker = read_marker(req.marker_path)
        project_dir = os.path.dirname(os.path.abspath(req.marker_path))
        register_path = find_or_migrate_register(
            project_dir,
            marker.get("project_number", ""),
            marker.get("project_name", ""),
        )
        register = open_register(register_path)
        return scan_project(marker, req.marker_path, register)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Failed to scan project: {e}")


def _enrich_drawings_with_parsed(register: dict[str, Any]) -> None:
    """Annotate each drawing with a transient ``_parsed`` field.

    The leading underscore signals this is a computed, view-only field —
    not part of the on-disk schema. ``save_register`` callers must strip
    it before persisting (slice 2 problem).
    """
    for d in register.get("drawings", []):
        try:
            parsed = parse_drawing_number(d["drawing_number"])
            seq_int = int(parsed.seq)
            band = find_band(parsed.discipline, parsed.type, seq_int)
            d["_parsed"] = {
                "discipline": parsed.discipline,
                "type_digit": parsed.type,
                "seq": seq_int,
                "band": (
                    {"start": band.start, "end": band.end, "label": band.label}
                    if band else None
                ),
            }
        except (DrawingNumberError, KeyError, ValueError):
            d["_parsed"] = None


@app.get("/api/project/recent")
def api_list_recent():
    try:
        return {"success": True, "recent": list_recent()}
    except Exception as e:
        raise HTTPException(500, f"Failed to list recent projects: {e}")


# ─── Register Endpoints ───────────────────────────────────────

@app.post("/api/register/save")
def api_save_register(req: SaveRegisterRequest):
    try:
        project_dir = os.path.dirname(os.path.abspath(req.marker_path))
        marker = read_marker(req.marker_path)
        register_path = find_or_migrate_register(
            project_dir,
            marker.get("project_number", ""),
            marker.get("project_name", ""),
        )

        # Strip transient _parsed fields if the frontend forgot to.
        register = req.register
        for d in register.get("drawings", []):
            d.pop("_parsed", None)

        # Validate before writing. Reject with a useful error list rather
        # than persist a broken register.
        errors = validate_register(register)
        if errors:
            raise HTTPException(
                400,
                detail={"message": "Register validation failed", "errors": errors},
            )

        save_register(register_path, register)
        # Regenerate Excel alongside the register file.
        xlsx_path = str(Path(register_path).with_suffix(".xlsx"))
        export_full(xlsx_path, register)
        return {"success": True}
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Failed to save register: {e}")


@app.post("/api/register/import-excel")
def api_import_excel(req: ImportExcelRequest):
    try:
        result = import_excel(req.xlsx_path)
        return {
            "success": True,
            "register": result["register"],
            "warnings": result["warnings"],
            "drawing_count": result["drawing_count"],
        }
    except FileNotFoundError:
        raise HTTPException(404, f"File not found: {req.xlsx_path}")
    except Exception as e:
        raise HTTPException(500, f"Failed to import Excel: {e}")


@app.get("/api/register/validate")
def api_validate_register(marker_path: str = Query(...)):
    try:
        project_dir = os.path.dirname(os.path.abspath(marker_path))
        marker = read_marker(marker_path)
        register_path = find_or_migrate_register(
            project_dir,
            marker.get("project_number", ""),
            marker.get("project_name", ""),
        )
        register = open_register(register_path)
        warnings = validate_register(register)
        return {"success": True, "warnings": warnings}
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Failed to validate register: {e}")
