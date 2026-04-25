# R3P Drawing List Manager

A standalone Tauri desktop application for managing project drawing registers at ROOT3POWER ENGINEERING. This is one of the tools in the ROOT3POWER tool family.

> **Status:** Framework migrated, UI in progress — consuming `@chamber-19/desktop-toolkit` v2.3.0; schema flip to flat v2 shape complete; UI screens come in a follow-up PR.

---

## Architecture

```
Drawing-List-Manager/
├── backend/                   Python FastAPI service (port 8001)
│   ├── app.py                 All API routes
│   ├── core/
│   │   ├── register.py        JSON register model (schema v2) + open/save helpers
│   │   ├── migration.py       v1 → v2 auto-migration on open
│   │   ├── drawing_number.py  Drawing number parser / validator
│   │   ├── project_config.py  Per-project marker + recent-list management
│   │   ├── standards.py       R3P drawing type standards (skeleton)
│   │   ├── excel_import.py    Legacy Master Deliverable List import
│   │   └── excel_export.py    Branded Excel export (Drawing Index + Revision History)
│   ├── tests/
│   │   ├── fixtures/          Sample v1 and v2 register JSON files
│   │   ├── test_drawing_number.py
│   │   └── test_migration.py
│   └── requirements.txt
│
└── frontend/                  React/Vite web + Tauri desktop shell
    ├── src/
    │   ├── App.jsx            Main React application (placeholder)
    │   ├── main.jsx           React entry point
    │   ├── splash.jsx         Splash screen (imports @chamber-19/desktop-toolkit/splash)
    │   └── updater.jsx        Updater UI (imports @chamber-19/desktop-toolkit/updater)
    ├── index.html
    ├── splash.html
    ├── updater.html
    ├── .npmrc                 GitHub Packages registry config
    ├── src-tauri/             Tauri desktop shell
    │   ├── tauri.conf.json    Window / bundle configuration (splash + main windows)
    │   ├── Cargo.toml         Rust dependencies (includes desktop-toolkit v2.3.0)
    │   ├── build.rs           Tauri build script
    │   ├── src/
    │   │   ├── main.rs        Binary entry point
    │   │   ├── lib.rs         TB-shaped startup sequence + Tauri commands
    │   │   └── sidecar.rs     PyInstaller sidecar + Python dev fallback
    │   ├── capabilities/      Tauri permission grants
    │   └── icons/             App icon assets
    ├── package.json
    └── vite.config.js         Multi-entry build (main / splash / updater)
```

**Data flow**

```
┌─────────────────────────────┐     HTTP/REST      ┌───────────────────┐
│  Tauri WebView               │ ─────────────────► │  Python FastAPI   │
│  React UI (port 1420 dev)   │ ◄───────────────── │  (port 8001)      │
└─────────────────────────────┘                     └───────────────────┘
        Tauri shell (Rust)            ▲
        wraps the WebView             │
                │                     │
                └── sidecar / Python ─┘
                    backend on startup
```

In production, Tauri spawns the bundled PyInstaller sidecar.
In dev mode, it falls back to `python -m uvicorn app:app --port 8001`.

---

## Register Schema (v2)

The register file (`.r3pdrawings.json`) uses a flat `drawings[]` list:

```json
{
  "schema_version": 2,
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

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check — returns `{"status":"ok","version":"1.0.0"}` |
| POST | `/api/project/create` | `{folder, project_number, project_name, paths}` → writes marker + empty register |
| POST | `/api/project/open` | `{marker_path}` → reads marker + register (auto-migrates v1) |
| GET | `/api/project/recent` | Returns recent-projects list |
| POST | `/api/register/save` | `{marker_path, register}` → saves + regenerates Excel |
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
