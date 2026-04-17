"""
R3P Drawing List Manager — Backend API

Routes:
    GET  /api/health                   Health check
    POST /api/register/open            Read a .r3pdrawings.json register from disk
    POST /api/register/save            Write a register to disk as JSON
    POST /api/register/import-excel    Import a legacy Master Deliverable List .xlsx
    POST /api/register/export-full     Export full branded .xlsx
    POST /api/register/export-transmittal-index  Export slim .xlsx for Transmittal Builder

Run:
    uvicorn app:app --reload --port 8001
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Optional

from core.register import open_register, save_register
from core.excel_import import import_excel
from core.excel_export import export_full, export_transmittal_index


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

class OpenRequest(BaseModel):
    path: str


class SaveRequest(BaseModel):
    path: str
    register: dict[str, Any]


class ImportExcelRequest(BaseModel):
    path: str


class ExportFullRequest(BaseModel):
    path: str
    register: dict[str, Any]


class ExportTransmittalRequest(BaseModel):
    path: str
    register: dict[str, Any]
    set_name: str


# ─── Register Endpoints ───────────────────────────────────────

@app.post("/api/register/open")
def api_open_register(req: OpenRequest):
    try:
        register = open_register(req.path)
        return {"success": True, "register": register}
    except FileNotFoundError:
        raise HTTPException(404, f"File not found: {req.path}")
    except Exception as e:
        raise HTTPException(500, f"Failed to open register: {e}")


@app.post("/api/register/save")
def api_save_register(req: SaveRequest):
    try:
        save_register(req.path, req.register)
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, f"Failed to save register: {e}")


@app.post("/api/register/import-excel")
def api_import_excel(req: ImportExcelRequest):
    try:
        result = import_excel(req.path)
        return {
            "success": True,
            "register": result["register"],
            "warnings": result["warnings"],
            "drawing_count": result["drawing_count"],
        }
    except FileNotFoundError:
        raise HTTPException(404, f"File not found: {req.path}")
    except Exception as e:
        raise HTTPException(500, f"Failed to import Excel: {e}")


@app.post("/api/register/export-full")
def api_export_full(req: ExportFullRequest):
    try:
        export_full(req.path, req.register)
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, f"Failed to export: {e}")


@app.post("/api/register/export-transmittal-index")
def api_export_transmittal_index(req: ExportTransmittalRequest):
    try:
        export_transmittal_index(req.path, req.register, req.set_name)
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, f"Failed to export transmittal index: {e}")
