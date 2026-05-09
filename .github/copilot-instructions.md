<!-- markdownlint-disable MD013 -->
# Copilot Instructions — Drawing List Manager

> **Repo:** `chamber-19/Drawing-List-Manager`
> **Role:** Backend service for managing project drawing registers (R3P numbering, revisions, Excel output).
> **Stack:** Python FastAPI backend; Tauri desktop shell (reference only, not built/deployed).

Use Chamber 19 shared conventions as reference guidance, but this file is the
repo-specific source of truth.

## Current Shape

Per May 2026 architecture, Drawing List Manager is a **stateless Python FastAPI backend service**:

- `backend/` — Production service (port 8001 by default)
  - HTTP API for register CRUD, validation, Excel export/import
  - JSON register is canonical; Excel files are generated artifacts
  - No sidecar; no AutoCAD/COM dependencies
- `frontend/` — **Reference code only (not built/deployed)**
  - Tauri desktop shell; preserved for historical reference
  - Contains activation gate, app router, sidecar glue code
  - Modern architecture routes through launcher instead

## Build And Test

**Backend:**

```bash
cd backend
python -m pytest backend/tests -v
python -m uvicorn app:app --reload --port 8001
```

**Frontend (reference; not deployed):**

```bash
cd frontend
npm ci
npm run build

cd frontend/src-tauri
cargo check
```

## Backend API Rules

- JSON register model is canonical. Excel files are **regenerated artifacts**; do not treat them as state.
- `drawing_number` (e.g., `R3P-25074-E6-0001`) is immutable register identity.
- Schema and migration versions are independent; migrations are append-only (v1 → v2 on open).
- All endpoints return structured HTTP responses. Client must handle 400 (validation) and 500 (internal error).
- No sidecar; no COM automation; no AutoCAD dependencies in the backend.

## HTTP Endpoints (Summary)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/project/create` | Create new project + marker file |
| POST | `/api/project/open` | Open project, read register, auto-migrate if needed |
| GET | `/api/project/recent` | List recent projects |
| POST | `/api/project/scan` | Diff register against on-disk files |
| POST | `/api/register/save` | Save register to disk + regenerate Excel |
| POST | `/api/register/validate` | Validate register, return warnings |
| POST | `/api/register/import-excel` | Legacy MDL import |
| GET | `/api/register/export` | Export register as branded Excel |

See `backend/app.py` and `docs/API.md` for full endpoint details.

## Dependency Contract (Reference Frontend)

Frontend is not deployed; dependencies are not actively maintained. If references need updating (e.g., toolkit security patches), apply them but do not bump versions unnecessarily.

## Review-Critical Rules

- `drawing_number` is immutable register identity; never allow renumbering.
- Register schema and project marker schema version independently.
- Excel files are regenerated artifacts; do not treat them as canonical state.
- All Excel exports use branded R3P template; styling is non-negotiable.
- User-facing behavior changes require `CHANGELOG.md` under `## [Unreleased]`.
- Backend validation errors must be structured and client-actionable.

## Troubleshooting

- **Backend fails to start:** Check Python version (3.13+), virtual environment activation, and `requirements.txt` installed packages.
- **Register schema mismatch:** Older v1 registers auto-migrate on first open. v2 → v3 migration adds `superseded` flag.
- **Excel export fails:** Verify openpyxl version and template file permissions.

Path-specific rules live under `.github/instructions/`.
