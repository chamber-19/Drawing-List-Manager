# R3P Drawing List Manager v1.0

A standalone Tauri desktop application for managing the project-lifetime drawing register at ROOT3POWER ENGINEERING. This is the second tool in the ROOT3POWER tool family, alongside [Transmittal Builder](https://github.com/Koraji95-coder/Transmittal-Builder).

The Drawing List Manager is the single source of truth for every drawing on a project — tracked from creation through multiple submittal revisions until issued for construction.

**Key capabilities:**

- **Drawing register** — Add, edit, and remove drawings across multiple sets (P&C, SUB, BESS, Physicals, and custom sets)
- **Revision history** — Track all submittal revisions (rev label + date) per drawing; bump, add, and view revision chains
- **Workflow status** — NOT CREATED YET · IN DESIGN · READY FOR DRAFTING · READY FOR SUBMITTAL
- **JSON-first storage** — Registers saved as `.r3pdrawings.json` — diff-friendly, human-readable, no merged-cell drift
- **Legacy Excel import** — Migrate existing Master Deliverable List `.xlsx` files into the JSON format in one click
- **Branded Excel export** — Generate a clean, styled `.xlsx` for distribution (one sheet per set)
- **Transmittal Builder integration** — Export a slim drawing index compatible with [Transmittal Builder's](https://github.com/Koraji95-coder/Transmittal-Builder) `/api/parse-index` endpoint

---

## Architecture

```
Drawing-List-Manager/
├── backend/                   Python FastAPI service (port 8001)
│   ├── app.py                 All API routes
│   ├── core/
│   │   ├── register.py        JSON register model + open/save helpers
│   │   ├── excel_import.py    Legacy Master Deliverable List import
│   │   └── excel_export.py    Branded Excel export (full + transmittal index)
│   └── requirements.txt
│
└── frontend/                  React/Vite web + Tauri desktop shell
    ├── src/
    │   ├── App.jsx            Main React application (single file, all inline)
    │   └── main.jsx           React entry point
    ├── src-tauri/             Tauri desktop shell
    │   ├── tauri.conf.json    Window / bundle configuration
    │   ├── Cargo.toml         Rust workspace manifest
    │   ├── build.rs           Tauri build script
    │   ├── src/
    │   │   ├── main.rs        Binary entry point
    │   │   └── lib.rs         Tauri app logic + backend auto-start
    │   ├── capabilities/      Tauri permission grants
    │   └── icons/             App icon assets
    ├── package.json
    └── vite.config.js
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
                └── spawns backend ───┘
                    on startup (dev)
```

In dev mode, Tauri automatically spawns the Python backend when the desktop app starts. The React frontend polls `/api/health` and shows the main UI once the backend is reachable.

---

## Register Format

Registers are stored as `*.r3pdrawings.json`:

```json
{
  "schema_version": 1,
  "project_number": "R3P-25074",
  "project_name": "Optional descriptive name",
  "updated_at": "2026-04-16T10:30:00Z",
  "sets": [
    {
      "name": "P&C",
      "drawings": [
        {
          "drawing_number": "R3P-25074-E0-0001",
          "description": "DRAWING INDEX",
          "status": "READY FOR SUBMITTAL",
          "notes": null,
          "revisions": [
            { "rev": "A", "date": "2025-10-17" },
            { "rev": "B", "date": "2026-03-16" }
          ]
        }
      ]
    }
  ]
}
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check — returns `{"status":"ok","version":"1.0.0"}` |
| POST | `/api/register/open` | Read a `.r3pdrawings.json` register from disk |
| POST | `/api/register/save` | Write a register to disk as JSON |
| POST | `/api/register/import-excel` | Import a legacy Master Deliverable List `.xlsx` |
| POST | `/api/register/export-full` | Write the full branded `.xlsx` (one sheet per set) |
| POST | `/api/register/export-transmittal-index` | Write the slim `.xlsx` for Transmittal Builder |

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

**Additional prerequisites (Linux)**

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
  patchelf libssl-dev libayatana-appindicator3-dev
```

### Run the desktop app (single command)

```bash
cd frontend
npm install
npm run desktop      # = tauri dev
```

Tauri will:
1. Start the Vite dev server on port 1420
2. Compile and launch the native Rust binary
3. **Automatically spawn the Python backend** on `127.0.0.1:8001`
4. Open the desktop window with a "Starting local services…" spinner
5. Show the main UI once the backend health check passes

> **Note:** Transmittal Builder runs on port 8000 — both tools can run concurrently.

### Python environment requirements

Tauri searches for Python in this order:

1. **`$CONDA_PREFIX`** — the active conda environment
2. **Well-known Miniconda / Anaconda install directories** under your home folder
3. **`python` on `PATH`** — final fallback

```bash
conda activate base        # or your project environment
cd frontend
npm run desktop
```

### Troubleshooting backend auto-start

| Symptom | Fix |
|---------|-----|
| "Python not found" in terminal | Activate your Miniconda environment and retry |
| "Could not find backend/app.py" | Run `npm run desktop` from the `frontend/` directory |
| "Backend process exited early" | Run `pip install -r backend/requirements.txt` |
| "Backend failed to start" in UI | Check terminal for errors; start backend manually |

### Manual backend (fallback)

```bash
# Terminal 1
cd backend
uvicorn app:app --reload --port 8001

# Terminal 2
cd frontend
npm run desktop
```

---

## Workflow: Register → Transmittal Builder

1. Maintain your drawing register in this tool
2. When ready to issue, go to **Actions → Export for Transmittal** (select a set)
3. The exported `.xlsx` has sheet `Drawing Index` with columns `Drawing No. | Description | Revision`
4. Drop that file into [Transmittal Builder](https://github.com/Koraji95-coder/Transmittal-Builder) to generate the transmittal package

---

## Version History

| Version | Description |
|---------|-------------|
| **1.0** | Initial release — JSON register, drawing CRUD with inline editing, revision tracking, Excel import/export, Tauri desktop shell |

---

ROOT3POWER ENGINEERING