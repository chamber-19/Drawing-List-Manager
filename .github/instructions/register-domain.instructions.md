---
applyTo: "backend/**"
---

# Drawing Register Domain Instructions

- `backend/core/register.py` owns register schema and validation rules.
- `backend/core/drawing_number.py` owns drawing-number parsing. Do not duplicate
  its regex elsewhere.
- Changing register schema requires a `SCHEMA_VERSION` bump, migration, fixture
  pair, and migration test.
- `backend/core/standards.py` is data mirroring the drafting standard; keep it
  free of IO and side effects.
- Excel export may change formatting without a schema bump because JSON is the
  canonical source.
