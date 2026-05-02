# Pre-Launch Schema Cleanup — 2026-04-30

## Independent version counters for marker and register

The marker file (`.r3p-project.json`) and the register file
(`<project_number>.r3pdrawings.json`) are independent files with independent
schemas. They have independent version counters. They are **NOT** meant to bump
in lockstep.

Rationale: the marker carries project-level metadata (paths, project number,
created date) that evolves at a different cadence than the drawing data stored
in the register. Coupling their versions would force unnecessary migrations
whenever either one changes.

## Version safety guards

Both files now carry forward-version guards. If a file on disk reports a
`schema_version` higher than the version this build of DLM understands, the
load raises `ValueError` with a clear message telling the user to update DLM.
Files that pre-date versioning (missing `schema_version`) default to version 1
for graceful backward compatibility.
