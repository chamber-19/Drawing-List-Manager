<!-- markdownlint-disable MD013 MD033 -->
# Copilot Instructions

> **Repo:** `chamber-19/Drawing-List-Manager`
> **Role:** Standalone Tauri app for managing project drawing registers (R3P numbering, phase/rev tracking, branded Excel rendering)

These instructions apply to GitHub Copilot (chat, agent mode, and code suggestions) when working in this repository. They are the same across every repo in the Chamber 19 tool family — what changes is the top matter above and the repo-specific rules at the bottom.

---

## Architecture context

This repo is part of the **Chamber 19 tool family**, a coordinated set of engineering tools with clear separation of concerns. Before making changes, understand which repo you're in and how it relates to the others.

### Repo roles

| Repo | Role | Language / stack |
| --- | --- | --- |
| `chamber-19/desktop-toolkit` | Shared framework for Tauri desktop apps (splash, updater, NSIS installer, Python sidecar plumbing) | Rust + JS + Python + NSIS |
| `chamber-19/autocad-pipeline` | Shared MSBuild props + csproj template for AutoCAD .NET plugins | MSBuild XML only |
| `chamber-19/object-totaler` | AutoCAD plugin: `TOTAL` and `TOTALSIM` commands for curve length totaling | C# / .NET, consumes `autocad-pipeline` |
| `chamber-19/launcher` | Tauri shell that installs, updates, and launches Chamber 19 tools | Rust + React, consumes `desktop-toolkit` |
| `chamber-19/transmittal-builder` | Standalone Tauri app for generating engineering transmittals | Rust + React + Python, consumes `desktop-toolkit` |
| `chamber-19/Drawing-List-Manager` | Standalone Tauri app for project drawing registers (this repo) | Rust + React + Python, consumes `desktop-toolkit` |

This repo is a **consumer of `desktop-toolkit`**. A toolkit release does not auto-propagate here — this repo pins an explicit version in `frontend/package.json` and `frontend/src-tauri/Cargo.toml`, and bumping those pins is a deliberate, reviewable action.

### Non-goals for this family

- **No Suite-style infrastructure.** The `Koraji95-coder/Suite` repo is a reference implementation that over-built shared infrastructure before tools existed. Don't reconstruct it. Every abstraction in this family must be extracted from at least two working concrete implementations.
- **No speculative shared code.** If a "helper" or "common utility" would be used by only one consumer today, it stays in that consumer. Duplication across two repos is tolerable; premature abstraction is not.
- **No multi-phase rollouts with layered toolkits.** Ship the smallest working thing, then extract from real duplication.

### Architectural decisions that persist across sessions

Use GitHub Copilot Memory (visible at Repo Settings → Copilot → Memory) to recall and update these as decisions evolve. Current state:

1. **`autocad-pipeline` is deliberately minimal.** v0.1.0 contains only `Directory.Build.props` and a parameterized `Plugin.csproj.template`. No shared C# code. No NuGet packages. No PowerShell scripts. These get added when plugin #2 exists and reveals concrete duplication, not before.
2. **AutoCAD plugin commands use bare names, no prefix.** `TOTAL`, not `CH19TOTAL`. The Chamber 19 identity lives in package metadata, not in every command typed at the AutoCAD command line.
3. **Launcher is the installer/updater for AutoCAD plugins.** It does not ship plugin source code. Plugins live in their own repos (e.g. `object-totaler`). Launcher fetches their releases from GitHub and installs the DLL to `%APPDATA%\Chamber19\AutoCAD\`, managing NETLOAD via the user's `acaddoc.lsp`.
4. **GitHub Releases is the distribution channel, not a network share.** Even for internal use. This keeps engineers on VPN-optional workflows and is ready for external distribution if that ever happens.
5. **Plugins and the launcher release on independent tags.** Plugin tags follow the form `v0.1.0` within their own repo. Launcher has its own version. A launcher update does not imply a plugin update and vice versa.
6. **The launcher repo was renamed from `shopvac` to `launcher`.** Old clones need `git remote set-url`. GitHub's redirect handles URLs automatically but don't rely on it in documentation.
7. **GitHub Packages versions are immutable.** A bad `@chamber-19/desktop-toolkit` release cannot be yanked cleanly. When a toolkit release breaks this repo, fix forward with a new patch version upstream rather than trying to recall the bad one.

When making a decision that affects another repo or that future sessions need to respect, persist it to Copilot Memory. Explicit state beats re-derivation every time.

### Memory scope — what to persist

GitHub Copilot Memory is enabled on this repo. Memories persist across sessions, are repo-scoped, tagged by agent and model, and auto-expire. The user can review and curate them at Repo Settings → Copilot → Memory.

**Persist to Copilot Memory:**

- Repo-specific discoveries that aren't in this instructions file (e.g. "the migration in `core/migration.py` had a same-iteration flag-update bug — added regression test in `test_register_validation.py`")
- Version-pin contracts with `desktop-toolkit` (e.g. "Drawing-List-Manager v1.x expects desktop-toolkit ^2.3.0+")
- Deviations from documented conventions
- Recurring traps that cost time to discover

**Do NOT persist to memory:**

- Architectural decisions that belong in this instructions file (they're more durable there, and they load every session)
- Cross-repo context that applies family-wide (belongs in this file's shared section)
- Per-PR context (PR title, branch name, transient commit hashes)
- Debugging state from a single session
- File contents — re-read files when needed, don't cache them in memory
- Anything you could infer by reading current files in the repo

When in doubt, prefer to re-read the repo over trusting stale memory. Memory is for repo-specific discoveries, not the shape of permanent decisions — those go in this file.

---

## Scope and style

### Coding style

- **Match the style already in the file.** Don't introduce a new formatting convention in a repo that has a consistent one. Read neighboring files first.
- **Be concise.** No explanatory comments on obvious code. Comments explain *why*, not *what*.
- **No scope creep.** If asked to fix a bug, fix the bug. Don't also refactor the surrounding code "while you're there" unless explicitly asked.
- **Prefer editing over rewriting.** When given a file to modify, produce a minimal diff. Don't rewrite the whole file to apply a one-line change.

### Response style in chat

- Match the length of the question. Short questions get short answers.
- Be direct. If a request is a bad idea, say so and explain why rather than complying silently.
- Don't narrate what you're about to do before doing it. Just do it, then describe the result if relevant.
- If uncertain, say you're uncertain. Don't fabricate confidence.

### When to push back

Actively push back when the user:

- Proposes reconstructing Suite-style infrastructure (e.g. a shared controller exe, a named-pipe RPC layer, a multi-layer toolkit with 4+ components) before there's concrete duplication justifying it
- Suggests building an abstraction "because we'll probably need it" — ask whether the need is experience-based or prediction-based
- Wants to combine scoped work (e.g. "while we're renaming the repo, let's also add the installer logic") — keep unrelated changes in separate PRs
- Wants to combine a `desktop-toolkit` pin bump with feature work in the same PR — separate them, because pin-bump PRs need to be reviewable as pin-bump PRs

---

## MCP server usage

This repo has MCP servers configured via the GitHub coding agent settings. Use them actively; don't work from assumptions when a tool can give you real data.

### `github` — preferred for anything on github.com

- Use `get_file_contents`, `search_code`, `list_commits`, `get_pull_request_diff`, etc. over `fetch` when the target is a GitHub URL
- Use `create_or_update_file`, `push_files`, and `delete_file` for direct commits instead of going through the `git` server when the change is narrow and well-scoped
- Use `create_issue`, `create_pull_request`, `create_branch` rather than asking the user to do these manually
- Use `list_workflow_runs` + `get_workflow_run` + `list_workflow_jobs` + `download_workflow_run_logs` to diagnose CI failures instead of asking the user to paste logs
- Use `list_releases` and `get_release` when checking version state across repos (especially `desktop-toolkit` when planning pin bumps)
- Use `list_secret_scanning_alerts` and `list_code_scanning_alerts` when reviewing security posture or assessing dependency-bump PRs

### `git` — local repo operations

- Use `git_status`, `git_diff`, `git_log`, `git_blame` freely to orient yourself
- Use `git_add`, `git_commit`, `git_branch`, `git_checkout`, `git_create_branch` for safe local operations. Use `git` for multi-file changes that need careful staging.
- **Never use destructive operations** (`git_reset`, `git_clean`, force-push equivalents) without explicit confirmation in chat first

### `filesystem` — scoped to `/workspaces`

- Read and write files in the current repo freely
- Don't write outside the current repo directory
- Prefer `github.get_file_contents` when you need a file from a *different* Chamber 19 repo

### `fetch` — non-GitHub URLs

- Use only for URLs that aren't on github.com

### `sequential-thinking`

- Use for any plan with 3+ dependent steps, especially cross-repo work (e.g. coordinating a `desktop-toolkit` bump with consumer testing here)
- Use when debugging a multi-step failure where the root cause isn't obvious

### `time`

- Use for CHANGELOG entry dates, release tags, and any ISO-formatted timestamp
- Do not guess the current date from memory — always fetch it via this server

### `svgmaker`

- Use for generating or editing SVG icons and illustrations
- Match the Chamber 19 design system: warm neutral backgrounds, copper (`#C4884D`) accent for primary elements, flat / geometric / single-weight strokes
- Prefer editing an existing SVG when iterating rather than regenerating from a prompt

---

## Design system

Shared visual language across all Chamber 19 tools:

### Colors

- **Background neutral (dark):** `#1C1B19`
- **Accent (copper):** `#C4884D`
- **Success:** `#6B9E6B`
- **Warning:** `#C4A24D`
- **Error:** `#B85C5C`
- **Info:** `#5C8EB8`

### Typography

- **Body:** DM Sans
- **Technical / data / filenames / drawing numbers:** JetBrains Mono
- **Display / headers:** Instrument Serif

### Tone

- Warm industrial. Engineering-grade, not corporate-slick.
- Short, matter-of-fact copy. Avoid marketing voice.
- No emoji in UI copy or product names (in commit messages or chat, fine).

---

## Release conventions

### Versioning

- All repos use **SemVer** (`vMAJOR.MINOR.PATCH`)
- Breaking changes require a major version bump and a clearly-marked `### Changed` / `### Removed` section in `CHANGELOG.md`
- Libraries (`desktop-toolkit`, `autocad-pipeline`) publish immutable version tags — downstream consumers pin exact versions
- Consumer apps (`launcher`, `object-totaler`, `transmittal-builder`, `Drawing-List-Manager`) can use `^x.y.z` ranges when depending on libraries

### Tags

- Single-tool repos: `v0.1.0`
- Never use decorated tags like `release-0.1.0` — the repo context makes the tool name redundant

### Release artifacts

- **Tauri app releases** must include:
  - The NSIS installer `.exe`
  - A `latest.json` manifest for the Tauri updater
  - Signature files for auto-update verification
  - Release notes linking to the CHANGELOG entry

### CHANGELOG

Every repo has a `CHANGELOG.md` following Keep a Changelog conventions. Every release tag must have a corresponding CHANGELOG entry. Unreleased changes accumulate under an `## [Unreleased]` heading and get promoted to a versioned heading at release time.

---

## PR and commit conventions

### Commit messages

- Imperative mood: `add plugin installer` not `added plugin installer`
- No period at the end of the subject line
- Wrap body at ~72 chars
- Conventional Commits prefix is optional but preferred (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)

### PR scope

- One concern per PR. Don't bundle a repo rename with a feature addition.
- PR titles follow the same style as commit messages
- PR description includes: what changed, why, and any follow-up needed

### Draft PRs

Open a PR as draft when:

- The PR bumps the `desktop-toolkit` pin and is waiting on CI verification before going live
- CI feedback is wanted on a partial change before final commits
- A release is staged but should not be merged until downstream verification is complete

Convert to ready-for-review only once the coordinated flow is complete.

---

## Security

- Never commit secrets, tokens, or API keys
- `.env` files must be in `.gitignore`
- MCP configs reference environment variable names, never literal tokens
- When in doubt, assume a value might be sensitive and don't log it
- Audit dependency-bump PRs for unexpected maintainer changes on popular packages (supply-chain attack vector)
- Use `github.list_secret_scanning_alerts` and `github.list_code_scanning_alerts` to review open security alerts before major releases

---

## Working across repos

When a task spans multiple Chamber 19 repos:

1. Use `sequential-thinking` to plan the order of operations
2. Start with the lowest-level dependency. If a change touches `desktop-toolkit` and `Drawing-List-Manager`, ship the toolkit change first, tag it, then bump `Drawing-List-Manager`'s pin
3. Make each repo's PR self-contained. A `Drawing-List-Manager` PR shouldn't say "this works once you merge #42 in desktop-toolkit." It should either pin to a released version or be explicitly marked "blocked on X."
4. If a `desktop-toolkit` bump reveals a problem, **fix forward** in the toolkit with a new patch version rather than yanking. GitHub Packages versions are immutable; a published bad release cannot be cleanly recalled, only superseded
5. If the relationship or decision is repo-specific (e.g. a new version pin contract), persist it to Copilot Memory. If it's family-wide, the user will update the instructions file.

---

## When you don't know

- Check Copilot Memory first (repo-specific discoveries and recurring traps live there)
- Then check the repo's `RELEASING.md`, `CHANGELOG.md`, and `README.md`
- Then search across the Chamber 19 repos via the `github` server
- Only then ask the user — and when you ask, ask a specific question, not an open-ended one

---

## Code change discipline

When editing existing code:

- Match existing style, even if you'd do it differently. Don't reformat
  adjacent code or "improve" comments that weren't part of the request.
- Don't refactor things that aren't broken. If you notice unrelated dead
  code or smells, mention them in the PR description — don't delete or
  fix them in this PR.
- Every changed line should trace directly to the user's request. If you
  can't justify a line, remove it.
- Clean up only the orphans your own changes created (unused imports,
  variables, helpers that became unreachable). Pre-existing dead code
  stays unless explicitly asked.

When implementing:

- Minimum code that solves the problem. No speculative abstractions, no
  flexibility that wasn't requested, no error handling for scenarios that
  can't actually happen.
- If you wrote 200 lines and 50 would suffice, rewrite it.
- Senior-engineer test: Would a careful reviewer call this overcomplicated?
  If yes, simplify before opening the PR.

When uncertain:

- State your assumptions explicitly. Don't guess silently.
- If multiple interpretations of the request exist, present them. Don't
  pick one and proceed.
- If something is unclear, stop and ask. Naming what's confusing is more
  helpful than producing a guess.

---

---

<!-- markdownlint-disable-next-line MD025 -->
# Repo-specific rules — Drawing-List-Manager

Everything above this section is shared across all Chamber 19 repos. Everything below is specific to `Drawing-List-Manager` and must be followed in every PR that touches this repo.

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
