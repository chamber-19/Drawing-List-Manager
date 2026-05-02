# Schema version counters are independent

The DLM project marker (`.r3p-project.json`) and the drawing register
(`.r3pdrawings.json`) are two independent files with two independent
schemas. They each have their own `schema_version` field with its own
counter.

These counters are deliberately NOT synchronized. The register has
been migrated three times and is at v3. The marker schema has never
changed and is at v1. There is no v1→v2 marker migration because the
marker schema didn't change.

## Bump policy

When the marker schema changes:
- Bump `MARKER_SCHEMA_VERSION` in `core/project_config.py`
- Add `_migrate_marker_v1_to_v2(data)` helper
- Wire it into `read_marker()` similarly to `migrate_register()` in
  `register.py`

When the register schema changes:
- Bump `SCHEMA_VERSION` in `core/register.py`
- Add `_migrate_vN_to_vN+1(data)` helper in `migration.py`
- Add it to the chain in `migrate_register()`

The two bumps happen independently.

## Safety guards

Both `read_marker()` and `open_register()` reject files with versions
HIGHER than the current schema (files from a newer DLM build). They
auto-migrate files with versions LOWER than current. Files with
matching version pass through.
