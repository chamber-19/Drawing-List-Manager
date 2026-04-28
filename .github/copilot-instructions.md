<!-- markdownlint-disable MD013 MD033 -->
# Copilot Instructions

> **Family-wide rules:** See [chamber-19/.github](https://github.com/chamber-19/.github/blob/main/.github/copilot-instructions.md) for Chamber 19 org-wide Copilot guidance. This file contains **repo-specific** rules only.

> **Repo:** `chamber-19/Drawing-List-Manager`
> **Role:** Standalone Tauri app for managing project drawing registers (R3P numbering, phase/rev tracking, branded Excel rendering)

This repo is a **consumer of `desktop-toolkit`**. Both pins must stay in sync: `frontend/package.json` (`@chamber-19/desktop-toolkit`) and `frontend/src-tauri/Cargo.toml` (`desktop-toolkit` crate). A pin bump touches both files in the same commit with both lockfiles refreshed.

## Build / test commands

```text
# Python backend tests
cd backend && python -m pytest

# Frontend (from frontend/)
npm run build

# Tauri (from frontend/src-tauri/)
cargo check
```

## 1. Schema is contract — version every change

The register schema (`backend/core/register.py`, `SCHEMA_VERSION`) and the project marker schema (`backend/core/project_config.py`, the marker dict's `schema_version` field) are independent contracts. They version separately. When changing either:

- Bump `SCHEMA_VERSION` in the relevant module
- Add a migration in `backend/core/migration.py` (for register) or extend `project_config.py` (for marker) to upgrade older files
- Add a fixture pair (`sample_v<N-1>_<thing>.json` + `sample_v<N>_<thing>.json`) under `backend/tests/fixtures/`
- Add a migration test that round-trips the v(N-1) fixture into the v(N) fixture, ignoring `updated_at`

Migrations are append-only. Once `SCHEMA_VERSION = 3` ships, do not modify the v1→v2 or v2→v3 logic — chain a v3→v4 instead.

## 2. The standards module is data, not logic

`backend/core/standards.py` is a pure-data catalogue mirroring `R3P-SPEC-002 — Drafting & Design Standard`. It must:

- Have zero IO, zero side effects, no Python code beyond the data and tiny pure helpers (`get_type_spec`, `find_band`, `default_set_for_type`)
- Reflect the spec exactly. When the spec adds a band or reserved sequence, this file changes; when it doesn't, this file doesn't
- Use `# TODO: Fill from R3P-SPEC-002 §X.Y` markers for unfilled slots — never placeholder strings like `"TODO"` in a structured field, because those will get rendered into a UI eventually

The `TypeSpec` shape carries both within-type bands (`bands: list[Band]`) and reserved sequences (`reserved: dict[int, str]`). Do not collapse `bands` to a single `series` string — the bands drive the standards-aware add/renumber UI later.

## 3. Drawing numbers are immutable identifiers

A drawing's `drawing_number` is its primary key in the register. Once written:

- Never rename a drawing in place. To "renumber", create a new entry and either delete the old one (loses history) or mark it superseded (preferred — leaves an audit trail in the revision history sheet)
- Never derive a drawing number from any field other than what the parser produces. Round-trip must hold: `format(parse(dn)) == dn` for every valid `dn`
- The parser in `core/drawing_number.py` is the only place where the regex lives. If validation needs to grow, grow the parser and add tests — don't write a second regex in another module

## 4. Excel artifacts are rendered, never edited

The JSON register (`<project_number>.r3pdrawings.json`) is canonical. The branded `.xlsx` next to it is a regenerated artifact, written fresh on every save. Therefore:

- Never round-trip user edits through the Excel file. The `excel_import.py` module exists for one-time MDL onboarding only — it is not a sync mechanism
- The Excel writer in `excel_export.py` may freely change formatting, column order, fonts, etc. without a schema version bump, because nothing reads the Excel back
- The "Drawing Index" sheet's column-grouping (collapsed-by-default REV/DATE block) is a UX requirement from the spec discussion — preserve it across changes
- The "Revision History" sheet emits one row per `(drawing, revision)` pair. Drawings with zero revisions emit zero history rows, not a placeholder

## 5. Phase/rev rules are domain-critical, encode them in the validator

`validate_register()` in `core/register.py` enforces the phase/rev rules from the design spec:

- IFA revs MUST be uppercase letters (`^[A-Z]+$`)
- IFC/IFR/IFB/IFF/IFRef revs MUST be digits (`^\d+$`) when following an IFC-numeric series
- `percent` is only valid on IFA revisions; null for everything else
- The first IFC rev after an IFA series MUST be `"0"` — not `"1"`, not `"01"`. Subsequent IFC/IFR revs increment from there
- Revision dates are chronological — each entry's date >= the previous entry's date

When changing these rules, update both the validator and the docstring at the top of `register.py`. The docstring is the canonical reference; production code must match it exactly.

## 6. Documentation currency

Every PR that changes user-visible behaviour updates `CHANGELOG.md` `## [Unreleased]`. Every PR that touches the API routes in `backend/app.py` updates the route table in `README.md`. Every PR that bumps the `@chamber-19/desktop-toolkit` pin in `frontend/package.json` also bumps the matching `tag = "vX.Y.Z"` in `frontend/src-tauri/Cargo.toml` in the same commit, with both lockfiles refreshed.

## 7. Markdown formatting

All `*.md` files in this repo must pass `markdownlint-cli2 "**/*.md"`. In short:

- Fenced code blocks: always declare a language. Use `text` for prose, ASCII art, or shell session output — never a bare block
- Use `_emphasis_` and `**strong**` consistently
- Surround headings, lists, and fenced blocks with blank lines
- First line of every file is a `#` H1

## 8. Reference docs

- <a>`README.md`</a> — top-level architecture and route table
- <a>`backend/core/register.py`</a> — register schema and validation rules (the docstring is canonical)
- <a>`backend/core/standards.py`</a> — R3P drawing type catalogue
- `R3P-SPEC-002 — Drafting & Design Standard` (out-of-tree document) — the spec that `standards.py` mirrors
