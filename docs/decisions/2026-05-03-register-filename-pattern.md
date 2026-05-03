# Register filename pattern — 2026-05-03

## Context

The old register filename (`{project_number}.r3pdrawings.json`, e.g.
`R3P-25074.r3pdrawings.json`) was easy to confuse with other JSON files in
the project directory and was at risk of accidental rename or deletion.

## Decision

### New filename pattern

```
{project_number}-{sanitized_project_name}-DrawingIndex-Metadata.json
```

Example: `R3P-25074-Substation-Upgrade-DrawingIndex-Metadata.json`

The long, descriptive suffix `DrawingIndex-Metadata` makes the file
self-identifying — its purpose is obvious even outside the application.

### Sanitisation rule for project names

Any character that is not alphanumeric, a hyphen (`-`), or an underscore (`_`)
is replaced with a hyphen.  Runs of hyphens are collapsed to a single hyphen,
and leading/trailing hyphens are stripped.

This rule keeps the filename safe on Windows, macOS, and Linux filesystems and
handles common user inputs such as spaces, ampersands, and slashes.

Implementation: `build_register_filename()` in `backend/core/register.py`.

### Filename frozen at creation

The register filename is generated **once** at project creation and **never
changes**, even if the project's `project_name` or `project_number` metadata
is updated later.  Renaming a Word document from inside the document would be
confusing — the same logic applies here.

### Silent auto-rename on first open (migration)

When DLM opens an existing project that still has the legacy filename
(`{project_number}.r3pdrawings.json`), it renames the file in place to the
new pattern, logs the rename at `INFO` level for traceability, and continues
loading normally.  No user prompt is shown.

The resolution order in `find_or_migrate_register()` is:

1. New-pattern file exists → load it.
2. Legacy file exists → rename to new pattern, log, load.
3. Neither exists → raise `FileNotFoundError`.

### Project marker is not renamed

Only the register filename changes.  The project marker (`.r3p-project.json`)
is out of scope for this change.

## Consequences

- New projects written by DLM will always use the new filename.
- Old projects are transparently upgraded on first open.
- The `register_file` field in the marker may become stale after auto-rename
  (it still points to the old name); this is harmless because `app.py` no
  longer reads `register_file` to locate the register — it calls
  `find_or_migrate_register()` instead.
- `project_number` is now validated against `^R3P-\d+$` at project creation
  time.  This was implicit before (drawing numbers relied on the format); it
  is now explicit.
