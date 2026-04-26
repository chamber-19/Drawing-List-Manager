# Changelog

All notable changes to the R3P Drawing List Manager are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
