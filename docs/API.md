# Drawing List Manager — API Documentation

**Service:** Python FastAPI backend for R3P drawing register management

**Default Port:** `8001` (uvicorn)

**Base URL:** `http://127.0.0.1:8001/api`

---

## Health Check

```bash
GET /api/health
```

Returns service status.

**Response (200 OK):**

```json
{
  "status": "healthy",
  "service": "drawing-list-manager-backend",
  "version": "1.0.0"
}
```

---

## Project Management

### Create Project

```bash
POST /api/project/create
```

Create a new project folder and marker file.

**Request:**

```json
{
  "project_root": "C:\\Projects\\R3P-25074",
  "project_number": "R3P-25074",
  "project_name": "Downtown Substation Expansion"
}
```

**Response (200 OK):**

```json
{
  "project_root": "C:\\Projects\\R3P-25074",
  "marker_path": "C:\\Projects\\R3P-25074\\.r3p-marker.json",
  "register_path": "C:\\Projects\\R3P-25074\\.r3pdrawings.json"
}
```

**Response (400 Bad Request):**

```json
{
  "detail": "Project folder already exists or is not writable"
}
```

### Open Project

```bash
POST /api/project/open
```

Open an existing project, read its register, and auto-migrate if needed.

**Request:**

```json
{
  "project_root": "C:\\Projects\\R3P-25074"
}
```

**Response (200 OK):**

```json
{
  "project_number": "R3P-25074",
  "project_name": "Downtown Substation Expansion",
  "current_phase": "IFC",
  "schema_version": 3,
  "drawings": [
    {
      "drawing_number": "R3P-25074-E6-0001",
      "description": "OVERALL SINGLE LINE DIAGRAM",
      "set": "P&C",
      "status": "READY FOR SUBMITTAL",
      "notes": null,
      "revisions": [
        {"rev": "A", "date": "2025-10-17", "phase": "IFA", "percent": 30},
        {"rev": "0", "date": "2026-01-10", "phase": "IFC", "percent": null}
      ],
      "superseded": false
    }
  ]
}
```

**Response (404 Not Found):**

```json
{
  "detail": "Project marker file not found: .r3p-marker.json"
}
```

### List Recent Projects

```bash
GET /api/project/recent
```

Return the user's recent project list from the marker index.

**Response (200 OK):**

```json
{
  "projects": [
    {
      "project_root": "C:\\Projects\\R3P-25074",
      "project_number": "R3P-25074",
      "last_opened": "2026-04-25T14:30:00Z"
    }
  ]
}
```

### Scan Project

```bash
POST /api/project/scan
```

Diff the register against on-disk DWG and PDF files.

**Request:**

```json
{
  "project_root": "C:\\Projects\\R3P-25074"
}
```

**Response (200 OK):**

```json
{
  "drawings": [
    {
      "drawing_number": "R3P-25074-E6-0001",
      "description": "OVERALL SINGLE LINE DIAGRAM",
      "on_disk": true,
      "file_count": 1,
      "latest_dwg": "R3P-25074-E6-0001-0.DWG",
      "revisions_on_disk": 0
    }
  ],
  "orphaned_files": [
    "R3P-25074-E6-0002-A.DWG"
  ]
}
```

---

## Register Operations

### Validate Register

```bash
GET /api/register/validate
Content-Type: application/json

{
  "project_root": "C:\\Projects\\R3P-25074"
}
```

Validate the register and return warnings.

**Response (200 OK):**

```json
{
  "valid": true,
  "warnings": []
}
```

**Response (with warnings):**

```json
{
  "valid": true,
  "warnings": [
    {
      "drawing_number": "R3P-25074-E6-0003",
      "message": "No revisions defined"
    }
  ]
}
```

### Save Register

```bash
POST /api/register/save
```

Write the updated register to disk and regenerate the Excel export.

**Request:**

```json
{
  "project_root": "C:\\Projects\\R3P-25074",
  "drawings": [
    {
      "drawing_number": "R3P-25074-E6-0001",
      "description": "OVERALL SINGLE LINE DIAGRAM",
      "set": "P&C",
      "status": "READY FOR SUBMITTAL",
      "notes": "Updated revision",
      "revisions": [
        {"rev": "A", "date": "2025-10-17", "phase": "IFA", "percent": 30},
        {"rev": "0", "date": "2026-01-10", "phase": "IFC", "percent": null},
        {"rev": "1", "date": "2026-04-25", "phase": "IFC", "percent": 100}
      ],
      "superseded": false
    }
  ]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "register_path": "C:\\Projects\\R3P-25074\\.r3pdrawings.json",
  "excel_path": "C:\\Projects\\R3P-25074\\Drawing Index.xlsx"
}
```

**Response (400 Bad Request):**

```json
{
  "detail": "Validation failed: duplicate drawing_number 'R3P-25074-E6-0001'"
}
```

### Export Register

```bash
GET /api/register/export?project_root=C%3A%5CProjects%5CR3P-25074
```

Export the register as branded Excel (Drawing Index + Revision History).

**Response (200 OK):**

- Returns `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- File attachment: `Drawing Index.xlsx`

### Import Excel (Legacy)

```bash
POST /api/register/import-excel
```

One-time legacy Master Deliverable List import from Excel.

**Request:**

```json
{
  "project_root": "C:\\Projects\\R3P-25074",
  "excel_path": "C:\\temp\\MasterDeliverableList.xlsx"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "imported_count": 42,
  "register_path": "C:\\Projects\\R3P-25074\\.r3pdrawings.json"
}
```

---

## Error Responses

### 400 Bad Request

Validation or input error.

```json
{
  "detail": "Invalid drawing_number format: ABC-123"
}
```

### 404 Not Found

Resource not found.

```json
{
  "detail": "Project not found at path: C:\\Projects\\NonExistent"
}
```

### 500 Internal Server Error

Backend failure.

```json
{
  "detail": "Internal server error: [error message]"
}
```

---

## Configuration

- **Port:** `DRAWING_LIST_MANAGER_PORT` (default `8001`)
- **Logging:** `DEBUG_LEVEL` (default `INFO`)
- **Excel template:** Embedded in `core/excel_export.py`

## Running the Backend

```bash
# Development with auto-reload
python -m uvicorn app:app --reload --port 8001

# Production
python -m uvicorn app:app --host 127.0.0.1 --port 8001 --workers 4
```

## Testing

```bash
# Run all tests
python -m pytest backend/tests -v

# Run specific test file
python -m pytest backend/tests/test_drawing_number.py -v

# Run with coverage
python -m pytest backend/tests --cov=core --cov-report=html
```
