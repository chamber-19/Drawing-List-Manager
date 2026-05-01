# Changelog

All notable changes to the R3P Drawing List Manager are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **App icons generated** — `frontend/src-tauri/icons/` now contains all
  required Tauri icon sizes (32×32, 128×128, 128×128@2x PNGs, ICO, and
  platform-specific sets) generated from `icon.svg` via `tauri icon`.
  This was the missing piece that caused Tauri to fall back to stale or
  wrong icons when building the NSIS installer.

- **NSIS installer metadata** — `tauri.conf.json` `bundle` section now
  declares `publisher`, `shortDescription`, and `longDescription` so that
  Windows Add/Remove Programs and the installer wizard show correct
  "Drawing List Manager" / "ROOT3POWER ENGINEERING" text instead of
  blank or inherited values.

### Fixed

- **Installer showed "Transmittal Builder" branding** — root-cause was
  a missing `frontend/src-tauri/icons/` directory; Tauri was picking up
  stale icons from a prior Transmittal Builder build on the same machine.
  Fixed by:
  1. Generating and committing DLM icons from `icon.svg`.
  2. Adding `publisher`, `shortDescription`, and `longDescription` to
     `tauri.conf.json` so all installer text is DLM-specific.
  3. Adding `frontend/src-tauri/installer/` to `.gitignore` (the
     `desktop-toolkit-sync-installer-assets` prebuild script already
     documented this requirement; DLM's `.gitignore` was simply missing
     the entry — without it, stale TB installer BMPs could persist in a
     developer's working tree across tool migrations).

- **App icons — 5 SVG proposals** added to `icons/proposals/` for DLM
  (blueprint/compass, stacked sheets, title block, DLM monogram, and isometric
  revision layers). Generated via the SVGMaker API. See
  `icons/proposals/README.md` for conversion instructions once a design is
  chosen.

- **Slice 2 — editing unlocked.** Workspace mutations are wired end-to-end:
  - Inline editing of a drawing's description, notes, status, and set
    from the inspector (single-mode).
  - Bulk **Advance to next rev** modal with a per-drawing preview table
    (suggests the next rev label using IFA-letter / IFC-number rules).
  - Bulk **Set status** modal.
  - **Mark superseded** flow (single + bulk) with a confirmation modal.
  - Per-band **Add drawing** modal that suggests free seqs in the band
    and validates the assembled drawing number locally.
  - Project-level **Promote to IFC** modal — every drawing whose latest
    rev is IFA gets a new IFC Rev 0 entry, with a preview of affected /
    skipped drawings.
  - **Create project** modal wired to `POST /api/project/create`.
  - Save flow with dirty-state tracking, `●` indicator in the project
    bar + window title, and an unsaved-changes confirmation when
    closing the project.
  - Toast notifications for save / mutation feedback.
  - Validation-error modal showing the structured `errors` array
    returned by the backend on a 400 from `/api/register/save`.
- `frontend/src/operations.js` — pure-function register mutations
  (`addDrawing`, `updateDrawing`, `advanceRev`, `setStatus`,
  `markSuperseded`, `promoteToIFC`, `previewPromoteToIFC`,
  `suggestNextRev`). Operations never mutate input.
- `frontend/src/dirty.js` — `useDirtyState` hook + `beforeunload`
  guard.
- `frontend/src/workspace/EditableField.jsx` — reusable inline-edit
  text/textarea.
- `frontend/src/workspace/Toast.jsx` — small toast system.
- `frontend/src/workspace/modals/` — `Modal` shell and seven modals
  (`AddDrawingModal`, `AdvanceRevModal`, `SetStatusModal`,
  `MarkSupersededModal`, `PromoteToIFCModal`, `CreateProjectModal`,
  `ValidationErrorModal`, `ConfirmUnsavedModal`, `ConfirmModal`).

### Changed

- **Schema bumped to v3.** Each drawing now carries a `superseded`
  boolean. `core/migration.py` adds the v2 → v3 migration and chains
  it from v1 too; existing v1 / v2 files load transparently and round-
  trip into v3 on the next save.
- `POST /api/register/save` now **validates** the register before
  writing; a failure returns **400** with `{detail: {message, errors}}`
  and leaves the existing register file untouched. The endpoint also
  strips transient `_parsed` fields from drawings server-side as a
  safety net.
- `POST /api/project/create` now returns the absolute `marker_path` so
  the frontend can navigate straight into the new project, and rejects
  with **409** when a `.r3p-project.json` already exists in the target
  folder.
- `validate_register` now rejects a non-boolean `superseded` field;
  missing `superseded` is treated as `False`.
- Workspace UI hides superseded drawings from the active band view by
  default (they remain in the register, visible to the validator and
  preserved through save).
- Inspector single-mode is now editable; bulk-mode action buttons are
  no longer disabled.
- `BandCard`'s "Add in this band" button is now active.
- `LandingView`'s "Create project" card is now active.

### Migration notes

- v2 → v3 is a pure additive migration; no data is lost. Files written
  by older versions load and re-save as v3.
- The migration is append-only: do not modify the v1→v2 or v2→v3
  logic. Future schema changes chain a v3→v4 step.

### Fixed

- `backend/requirements.txt` now lists `httpx` and `pytest`. The
  `tests/test_app.py` suite imports `fastapi.testclient.TestClient`,
  which requires `httpx` at runtime; CI installs from `requirements.txt`
  and was failing at test collection without it.

## [Slice 1]

### Added

- Workspace UI: type-band tree navigation, band cards with grouped drawings,
  bottom-docked inspector for single + bulk selection (read-only).
- Reconcile view diffing the project register against on-disk DWG/PDF files.
- `POST /api/project/scan` endpoint and `core/project_scan.py` module that
  walks the configured `drawings_dir` and `pdfs_dir`, returns the raw file
  inventory and three diff buckets (`missing_dwg`, `orphan_dwg`,
  `orphan_pdf`, `stale_pdf`).

### Changed

- `POST /api/project/open` response now includes a transient `_parsed`
  field on each drawing (`discipline`, `type_digit`, `seq`, `band`) derived
  from the drawing number via the standards catalogue. The leading
  underscore signals view-only / non-persisted; callers must strip it
  before saving (slice 2 wires this into the save path).
- `POST /api/project/open` response now also echoes the absolute
  `marker_path` so the frontend can chain follow-up calls without
  re-resolving the path.

## [1.0.0] — 2026-04-16

### Added

- Framework migration to `@chamber-19/desktop-toolkit` v2.3.0.
- Flat v2 register schema with auto-migration from v1.
- Drawing-number parser, project-config marker, standards skeleton.
- Branded Excel export (Drawing Index + Revision History sheets).
