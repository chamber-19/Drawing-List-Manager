# Drawing List Manager Frontend — DEPRECATED

This directory contains the reference Tauri desktop shell for Drawing List Manager.

**Status:** Reference code only (not built or deployed as of May 2026)

Per the May 2026 Chamber 19 architecture refactor, Drawing List Manager is now a **stateless Python FastAPI backend service** (see `../backend/`). The universal launcher handles desktop integration, app routing, and activation for all tools.

## Why It's Here

This code is preserved for:

- Historical reference (Tauri IPC patterns, React UI layout, sidecar spawn logic)
- Understanding legacy activation flow before `desktop-toolkit` centralized it
- Reverse-engineering the old architecture if needed

## What Changed

| Component | Then | Now |
| --- | --- | --- |
| **Desktop shell** | This Tauri app | Universal launcher (`chamber-19/launcher`) |
| **Backend** | Bundled PyInstaller sidecar | Standalone HTTP service (port 8001) |
| **Activation** | Tauri Rust commands | `desktop-toolkit` FastAPI service + launcher client |
| **UI** | React components here | Hosted in launcher or backend's Swagger UI |

## If You Need This

- **To run the service:** Use `cd ../backend && python -m uvicorn app:app --port 8001`
- **To access the UI:** Use launcher at `chamber-19/launcher` instead
- **To understand Tauri patterns:** Reference `src-tauri/src/lib.rs` (sidecar spawn, IPC)

## Dependencies

Frontend dependencies are NOT actively maintained. Do not bump versions unless critical security patches are required.

See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for diagnostic playbook.

