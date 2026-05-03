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
    resolve_paths,
    add_recent,
    list_recent,
)
from core.project_scan import scan_project
from core.folder_scan import scan_drawings_folder
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
    drawings_root: str = ""  # optional: absolute path to scan for .dwg files at creation


class OpenProjectRequest(BaseModel):
    marker_path: str


class ScanProjectRequest(BaseModel):
    marker_path: str


class FolderScanRequest(BaseModel):
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

        # Determine the drawings root: prefer explicitly supplied path, then
        # resolve the drawings_dir from the marker.
        drawings_root = (req.drawings_root or "").strip()
        if not drawings_root:
            resolved = resolve_paths(marker, marker_path)
            drawings_root = resolved.get("drawings_dir", "")

        folder_scan = None
        if drawings_root and os.path.isdir(drawings_root):
            folder_scan = scan_drawings_folder(drawings_root)
            if folder_scan["drawings"]:
                # Populate the register with the scanned drawings.
                project_dir = os.path.dirname(marker_path)
                register_path = find_or_migrate_register(
                    project_dir,
                    marker.get("project_number", ""),
                    marker.get("project_name", ""),
                )
                register = open_register(register_path)
                _populate_register_from_scan(register, folder_scan)
                save_register(register_path, register)

        return {
            "success": True,
            "marker": marker,
            "marker_path": marker_path,
            "folder_scan": folder_scan,
        }
    except FileExistsError as e:
        raise HTTPException(409, str(e))
    except Exception as e:
        raise HTTPException(500, f"Failed to create project: {e}")


def _drawing_entry_from_file(file_info: dict, pdf_info: dict | None, drawings_root: str) -> dict:
    """Build a minimal valid drawing register entry from a scanned DWG file.

    Parameters
    ----------
    file_info:
        FileInfo dict from folder_scan (filename, stem, path).
    pdf_info:
        Matching FileInfo for the PDF, or None.
    drawings_root:
        Absolute path to the drawings root, used to build relative paths.
    """
    # pdf_path is relative to drawings_root and includes the pdf sub-dir name.
    pdf_path: str | None = None
    if pdf_info is not None:
        try:
            pdf_path = os.path.relpath(pdf_info["path"], drawings_root)
        except ValueError:
            pdf_path = pdf_info["path"]

    return {
        "drawing_number": file_info["stem"],
        "description": "",
        "set": "P&C",
        "status": "NOT CREATED YET",
        "notes": None,
        "superseded": False,
        "revisions": [],
        # File-tracking fields (transparent to validate_register).
        "filename": file_info["filename"],
        "dwg_path": file_info["filename"],  # top-level, so just the filename
        "pdf_path": pdf_path,
    }


def _populate_register_from_scan(register: dict, folder_scan: dict) -> None:
    """Add scanned drawings to *register* in-place.

    Existing register entries whose ``drawing_number`` matches a scanned
    .dwg stem are updated with file-tracking fields (``filename``,
    ``dwg_path``, ``pdf_path``) but are otherwise left unchanged.

    New drawings (stems not already in the register) are appended as
    minimal entries.
    """
    drawings_root = folder_scan["drawings_root"]

    # Build a lookup of existing drawing_numbers (case-insensitive).
    existing_dns: dict[str, dict] = {
        d["drawing_number"].lower(): d for d in register.get("drawings", [])
    }

    # Build pdf lookup by stem (case-insensitive).
    pdf_by_stem: dict[str, dict] = {}
    for pair in folder_scan.get("matched", []):
        pdf_by_stem[pair["drawing"]["stem"].lower()] = pair["pdf"]
    for d_info in folder_scan.get("drawings_without_pdfs", []):
        pdf_by_stem.setdefault(d_info["stem"].lower(), None)  # type: ignore[arg-type]

    all_dwg_infos: list[dict] = (
        [pair["drawing"] for pair in folder_scan.get("matched", [])]
        + folder_scan.get("drawings_without_pdfs", [])
    )

    new_entries: list[dict] = []
    for dwg_info in all_dwg_infos:
        stem_lower = dwg_info["stem"].lower()
        pdf_info = pdf_by_stem.get(stem_lower)

        if stem_lower in existing_dns:
            # Update file-tracking fields on the existing entry.
            entry = existing_dns[stem_lower]
            entry["filename"] = dwg_info["filename"]
            entry["dwg_path"] = dwg_info["filename"]
            if pdf_info is not None:
                try:
                    entry["pdf_path"] = os.path.relpath(pdf_info["path"], drawings_root)
                except ValueError:
                    entry["pdf_path"] = pdf_info["path"]
            else:
                entry.setdefault("pdf_path", None)
        else:
            new_entries.append(
                _drawing_entry_from_file(dwg_info, pdf_info, drawings_root)
            )

    register.setdefault("drawings", [])
    register["drawings"].extend(new_entries)


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


@app.post("/api/project/folder-scan")
def api_folder_scan(req: FolderScanRequest):
    """Scan the project's drawings folder for .dwg/.pdf files and update register.

    Re-runs scan_drawings_folder() against the resolved drawings_dir path from
    the project marker.  Any new .dwg files found are added to the register as
    minimal entries.  Existing entries are updated with current pdf_path.
    Drawings that have disappeared from disk are NOT removed (that requires a
    separate user-initiated workflow).

    Returns the FolderScanResult so the frontend can update the needs-attention
    panel without a full project reload.
    """
    try:
        marker = read_marker(req.marker_path)
        project_dir = os.path.dirname(os.path.abspath(req.marker_path))
        register_path = find_or_migrate_register(
            project_dir,
            marker.get("project_number", ""),
            marker.get("project_name", ""),
        )
        register = open_register(register_path)

        resolved = resolve_paths(marker, req.marker_path)
        drawings_root = resolved.get("drawings_dir", "")

        folder_scan = scan_drawings_folder(drawings_root)

        if folder_scan["drawings"]:
            _populate_register_from_scan(register, folder_scan)
            save_register(register_path, register)
            _enrich_drawings_with_parsed(register)

        return {"success": True, "folder_scan": folder_scan, "register": register}
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Failed to folder-scan project: {e}")


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
