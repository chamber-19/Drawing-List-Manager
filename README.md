# R3P Drawing List Manager

Backend service for managing project drawing registers at ROOT3POWER ENGINEERING. Handles register CRUD, R3P numbering validation, revision tracking, and branded Excel export.

**Status:** Production-ready backend service (v1.0.0). Delivered via Chamber 19 launcher with universal desktop shell.

---

## Quick Start

**Run the backend:**

```bash
cd backend
python -m uvicorn app:app --reload --port 8001
```

**Test the backend:**

```bash
cd backend
python -m pytest tests/ -v
```

**Access the service:**

- Health check: `curl http://127.0.0.1:8001/api/health`
- API docs: `http://127.0.0.1:8001/docs` (Swagger UI)
- See [docs/API.md](docs/API.md) for full endpoint reference

---

## Architecture

### Current (May 2026)

```text
┌────────────────────────────┐
│    Launcher (Tauri shell)  │
│  (chamber-19/launcher)     │
└───────────┬────────────────┘
            │
            │ HTTP (activation + routing)
            │
┌───────────▼────────────────┐
│ Drawing List Manager       │
│ Backend (FastAPI)          │
│ Port 8001                  │
│ ├─ Project management      │
│ ├─ Register CRUD           │
│ ├─ Excel export/import     │
│ └─ Validation              │
└────────────────────────────┘
```

### Legacy

The `frontend/` directory contains the reference Tauri desktop shell. It is **NOT built or deployed** in the current architecture. See [frontend/README.md](frontend/README.md) for historical context.

---

## Register Schema (v3)

The register file (`.r3pdrawings.json`) uses a flat `drawings[]` list:

```json
{
  "schema_version": 3,
  "project_number": "R3P-25074",
  "project_name": "My Project",
  "current_phase": "IFA",
  "updated_at": "2026-04-25T00:00:00Z",
  "drawings": [
    {
      "drawing_number": "R3P-25074-E6-0001",
      "description": "OVERALL SINGLE LINE DIAGRAM",
      "set": "P&C",
      "status": "READY FOR SUBMITTAL",
      "notes": null,
      "revisions": [
        {"rev": "A", "date": "2025-10-17", "phase": "IFA", "percent": 30},
        {"rev": "0", "date": "2026-01-10", "phase": "IFC", "percent": null}
      ]
    }
  ]
}
```

**v1 → v2 auto-upgrade:** legacy files are automatically migrated when opened via `open_register()`. The original nested `sets[].drawings[]` structure is flattened; SUB / BESS sets are re-classified by drawing type digit.

---

## Workspace UI

Slice 1 ships a read-only workspace organised around three view tabs:

- **Drawings** — three-zone shell: type-band tree on the left, banded card list in the middle, bottom-docked inspector that shows per-drawing details on single selection or a summary grid + disabled bulk-action buttons on multi-select. Shift-click extends a range; Cmd/Ctrl-click toggles individual rows; Escape clears.
- **Reconcile** — three cards diffing the register against the project's on-disk DWG and PDF folders: drawings present in the register but missing a DWG, files on disk with no register entry, and PDFs whose rev label is behind the register's current rev. Each row is clickable and jumps back to the drawings tab with the matching band selected.
- **Export** — placeholder; lights up in the next slice.

All mutating affordances (`Add drawing`, `Save`, `Export`, `Promote to IFC`, the four bulk-action buttons, project `Create`) render but are disabled with a "Coming next slice" tooltip — the slice 1 boundary is intentionally read-only so the navigation primitives are exercised before mutation lands.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check — returns `{"status":"ok","version":"1.0.0"}` |
| POST | `/api/project/create` | `{folder, project_number, project_name, paths}` → writes marker + empty register. Returns `{marker, marker_path}`. Rejects with **409** if a `.r3p-project.json` already exists in the folder |
| POST | `/api/project/open` | `{marker_path}` → reads marker + register (auto-migrates v1 → v2 → v3); each drawing is annotated with a transient `_parsed` field carrying `{discipline, type_digit, seq, band}` derived from the drawing number. The leading underscore signals "view-only, not persisted" |
| POST | `/api/project/scan` | `{marker_path}` → walks the project's `drawings_dir` and `pdfs_dir` and returns a structured diff (`missing_dwg`, `orphan_dwg`, `orphan_pdf`, `stale_pdf`) plus the raw file inventory |
| GET | `/api/project/recent` | Returns recent-projects list |
| POST | `/api/register/save` | `{marker_path, register}` → validates, saves + regenerates Excel. Strips transient `_parsed` fields before persisting. Rejects with **400** and `{detail: {message, errors}}` if the register fails validation; the existing register file is left untouched |
| POST | `/api/register/import-excel` | `{marker_path, xlsx_path}` → one-time legacy MDL import |
| GET | `/api/register/validate` | `?marker_path=...` → returns validation warnings |

---

## Setup

> **One-time setup:** the `chamber-19/Drawing-List-Manager` repo must be granted Read access on the `@chamber-19/desktop-toolkit` package settings page before CI can install it. See https://github.com/orgs/chamber-19/packages/npm/desktop-toolkit/settings → Manage Actions access → Add Repository.

See [`desktop-toolkit/docs/CONSUMING.md`](https://github.com/chamber-19/desktop-toolkit/blob/main/docs/CONSUMING.md) for the full onboarding guide.

---

## Quick Start — Web (browser)

```bash
# Terminal 1 — Python backend
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8001

# Terminal 2 — Vite dev server
cd frontend
npm install
npm run dev          # http://localhost:1420
```

API docs at <http://localhost:8001/docs>

---

## Quick Start — Tauri Desktop

**Prerequisites (all platforms)**

1. Python 3.10+ with `pip` (or a Conda/virtualenv environment)
2. Backend dependencies installed:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
3. [Rust](https://www.rust-lang.org/tools/install) — `rustup` installs the toolchain
4. Node.js ≥ 20 and npm
5. A GitHub token with `read:packages` scope set as `NODE_AUTH_TOKEN` (for `@chamber-19/desktop-toolkit`):
   ```bash
   export NODE_AUTH_TOKEN=ghp_xxxx
   ```

**Additional prerequisites (Linux)**

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
  patchelf libssl-dev libayatana-appindicator3-dev
```

### Run the desktop app

```bash
cd frontend
npm install
npm run desktop      # = tauri dev
```

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt pytest
pytest tests/
```

---

## Version History

| Version | Description |
|---------|-------------|
| **1.0** | Framework migrated to `@chamber-19/desktop-toolkit` v2.3.0; schema flipped to flat v2; migration, drawing number parser, project config, standards skeleton added |
| **0.1** | Initial shell — Tauri desktop scaffolding, placeholder UI, FastAPI backend stub |

---

ROOT3POWER ENGINEERING
