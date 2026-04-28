<!-- markdownlint-disable MD013 -->
# Copilot Instructions — Drawing List Manager

> **Repo:** `chamber-19/Drawing-List-Manager`
> **Role:** Tauri app for project drawing registers, R3P numbering, revisions, and branded Excel output.

Use Chamber 19 shared conventions as reference guidance, but this file is the
repo-specific source of truth.

## Current Shape

- `backend/` is a Python FastAPI service. The JSON register is canonical.
- `frontend/` is the React/Vite/Tauri desktop shell.
- This repo consumes `desktop-toolkit` through npm and Cargo.

## Build And Test

```text
cd backend
python -m pytest

cd frontend
npm ci
npm run build

cd frontend/src-tauri
cargo check
```

## Dependency Contract

- Toolkit bumps must update `frontend/package.json` and
  `frontend/src-tauri/Cargo.toml` together, with both lockfiles refreshed.
- Dependabot must not bump `@chamber-19/desktop-toolkit` or Rust
  `desktop-toolkit`; those are paired manual review PRs.

## Review-Critical Rules

- `drawing_number` is an immutable register identity.
- Register schema and project marker schema version independently; migrations
  are append-only.
- Excel files are regenerated artifacts. Do not treat them as canonical state.
- User-facing behavior changes require `CHANGELOG.md` under `## [Unreleased]`.

Path-specific rules live under `.github/instructions/`.
