# Folder scan design — 2026-05-03

## Context

When a user creates a new project in DLM, the drawing register starts empty.
The user must then manually add each drawing entry, which is tedious when an
existing drawings folder already contains `.dwg` (and optionally `.pdf`) files.

This ADR records the design decisions for the autodetect feature that
automatically scans a nominated drawings folder at project creation and
populates the register from what it finds.

## Decisions

### 1. Top-level scan only (not recursive)

**Decision:** `scan_drawings_folder()` scans the root of the drawings folder
for `.dwg` files only. It does not recurse into subdirectories.

**Rationale:** Real R3P projects organise drawings into `Live/`, `Archive/`,
and `WIP/` subdirectories. Recursing into all of them would mix current and
historical drawings, making the initial register noisy and harder to review.
Top-level scan reflects the "live, active drawings" convention for the nominated
folder.

**Future:** Recursive scanning (with include/exclude lists for subdirectory
names) is a natural follow-on feature and can be added without schema changes.

### 2. PDF subdirectory convention (`pdf/`)

**Decision:** PDFs are expected in a subdirectory of the drawings root whose
name is `pdf` (case-insensitive). Directory names `pdf`, `PDF`, `Pdf`, `PDFs`,
`pdfs` are all accepted. Only one level of nesting is scanned.

**Rationale:** The common practitioner convention for keeping issued PDFs
alongside source DWGs is a flat `pdf/` subfolder inside the drawings directory.
This is a well-understood layout across CAD/document management workflows.
Using a case-insensitive match avoids surprises on case-preserving filesystems
(macOS, Windows) where users may name the folder `PDF` or `PDFs`.

Using the existing `pdfs_dir` path from the project marker was considered but
rejected: `scan_drawings_folder()` is designed as a standalone utility that
works without a project marker. The `pdf/` convention keeps the scanner
self-contained.

### 3. Filename-stem matching (not full path, not DWG metadata)

**Decision:** Drawings and PDFs are paired by filename stem (the portion of
the filename before the extension), compared case-insensitively.
`E0-001.dwg` pairs with `E0-001.pdf`.

**Rationale:**
- **Not full path:** The DWG and PDF live in different directories (`./` vs
  `pdf/`), so path equality is not useful.
- **Not DWG metadata:** Reading metadata from inside a `.dwg` file (block
  names, title-block attributes, etc.) would require a DWG parser, adding a
  significant dependency and complexity. Filename stems are already meaningful
  and consistently named in R3P projects.
- **Case-insensitive:** Filesystem case rules vary by platform; case-insensitive
  comparison avoids false negatives on mixed-case environments.

### 4. Mismatches are informational, not errors

**Decision:** Drawings without a matching PDF, and PDFs without a matching
drawing, are surfaced in a "needs attention" panel in the UI.  They are NOT
treated as errors that block project creation or saving.

**Rationale:** The most common case for "drawing without PDF" is that PDFs
haven't been generated yet — especially on a freshly scanned folder.  The most
common case for "PDF without drawing" is a supplementary or legacy document.
Both are normal states during active project work.

Treating them as errors would create unnecessary friction. Surfacing them
visually (collapsible, non-alarming) gives the user the information they need
without blocking their workflow.

### 5. Read-only scan

**Decision:** The scanner reads files from disk but never moves, renames, or
modifies them. The user's file organisation is preserved exactly as found.

**Rationale:** DLM is a register management tool, not a file manager. Modifying
the user's filesystem layout would be surprising and potentially destructive.

### 6. Re-scan does not remove orphan entries

**Decision:** Re-scanning adds new drawings found on disk and updates PDF match
status for existing entries. It does NOT remove register entries for drawings
that have disappeared from disk.

**Rationale:** A file disappearing from disk could mean it was archived, moved,
or accidentally deleted. Silently dropping it from the register would lose the
user's metadata (description, revisions, status). Removing orphan entries is a
separate, explicit user action (out of scope for the initial implementation).

## Consequences

- `backend/core/folder_scan.py` implements `scan_drawings_folder()`.
- `POST /api/project/create` auto-scans the resolved `drawings_dir` and
  populates the register with any `.dwg` files found.
- `POST /api/project/folder-scan` provides the re-scan capability.
- Each scanned drawing is added to the register with `filename`, `dwg_path`,
  and `pdf_path` fields alongside the standard register fields. These fields
  are optional and transparent to `validate_register()`.
- The frontend `FolderScanPanel` component displays the needs-attention
  section and provides the Re-scan button.
