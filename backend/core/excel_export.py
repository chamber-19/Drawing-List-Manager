"""
core/excel_export.py — Generate clean branded .xlsx output.

Two exports:

1. export_full(path, register)
   One sheet per set.  Fresh branded layout:
     Row 1  — Project header (ROOT3POWER · project_number · SET NAME), copper bg
     Row 2  — Status summary strip
     Row 3  — Blank spacer
     Row 4  — Column headers
     Row 5+ — Data rows

   Columns: # | Drawing Number | Description | Revisions | Status | Notes

2. export_transmittal_index(path, register, set_name)
   Single sheet "Drawing Index" for consumption by Transmittal Builder.
   Columns: Drawing No. | Description | Revision (latest non-empty rev)
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

import openpyxl
from openpyxl.styles import (
    Alignment,
    Border,
    Font,
    GradientFill,
    NamedStyle,
    PatternFill,
    Side,
)
from openpyxl.utils import get_column_letter


# ─── Colour palette (mirrors the JS design system tokens) ─────

_COPPER = "C4884D"
_BG_DARK = "252420"
_CREAM = "F0ECE4"
_MUTED = "A39E93"

# Status colours
_STATUS_STYLES: dict[str, dict[str, str]] = {
    "NOT CREATED YET": {"fill": "E8E6E0", "font": "4A4742"},
    "IN DESIGN": {"fill": "D6E4F0", "font": "1D4E6F"},
    "READY FOR DRAFTING": {"fill": "F5E9CC", "font": "7A5E12"},
    "READY FOR SUBMITTAL": {"fill": "D9ECD9", "font": "2C5F2C"},
}

_THIN = Side(style="thin", color="D0CCC5")
_THIN_BORDER = Border(
    left=_THIN, right=_THIN, top=_THIN, bottom=_THIN
)


# ─── Helpers ──────────────────────────────────────────────────

def _pf(hex_color: str) -> PatternFill:
    return PatternFill(fill_type="solid", fgColor=hex_color)


def _font(bold=False, color="F0ECE4", size=10, italic=False, name="Calibri") -> Font:
    return Font(name=name, bold=bold, color=color, size=size, italic=italic)


def _align(h="center", v="center", wrap=False) -> Alignment:
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)


def _natural_sort_key(drawing_number: str):
    """Key for natural (human-friendly) sort of drawing numbers."""
    return [
        int(part) if part.isdigit() else part.lower()
        for part in re.split(r"(\d+)", drawing_number)
    ]


def _status_counts(drawings: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {
        "READY FOR SUBMITTAL": 0,
        "READY FOR DRAFTING": 0,
        "IN DESIGN": 0,
        "NOT CREATED YET": 0,
    }
    for d in drawings:
        s = d.get("status", "NOT CREATED YET")
        if s in counts:
            counts[s] += 1
    return counts


def _format_revisions(revisions: list[dict]) -> str:
    """Format revision list as: A (10/17/25) → B (03/16/26) — latest last."""
    parts: list[str] = []
    for r in revisions:
        rev_label = r.get("rev", "")
        date_str = r.get("date", "")
        if not rev_label:
            continue
        if date_str:
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                # Use month/day without leading zero, cross-platform
                date_str = f"{dt.month}/{dt.day}/{dt.strftime('%y')}"
            except ValueError:
                pass
        if date_str:
            parts.append(f"{rev_label} ({date_str})")
        else:
            parts.append(rev_label)
    return " \u2192 ".join(parts)


def _latest_rev(revisions: list[dict]) -> str:
    """Return the latest non-empty rev label."""
    for r in reversed(revisions):
        v = r.get("rev", "").strip()
        if v and v != "-":
            return v
    return "-"


# ─── Full Export ───────────────────────────────────────────────

def export_full(path: str, register: dict[str, Any]) -> None:
    """Write the full branded .xlsx register."""
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # remove default sheet

    project_number = register.get("project_number", "")

    for set_obj in register.get("sets", []):
        set_name = set_obj.get("name", "Set")
        drawings = sorted(
            set_obj.get("drawings", []),
            key=lambda d: _natural_sort_key(d.get("drawing_number", "")),
        )

        ws = wb.create_sheet(title=set_name[:31])  # Excel sheet name limit
        _write_set_sheet(ws, project_number, set_name, drawings)

    wb.save(path)


def _write_set_sheet(
    ws,
    project_number: str,
    set_name: str,
    drawings: list[dict],
) -> None:
    # Column widths (in character units)
    col_widths = [6, 22, 48, 32, 22, 40]
    col_letters = [get_column_letter(i + 1) for i in range(len(col_widths))]
    for i, w in enumerate(col_widths):
        ws.column_dimensions[col_letters[i]].width = w

    total = len(drawings)
    counts = _status_counts(drawings)

    # ── Row 1: Project header ──────────────────────────────────
    ws.row_dimensions[1].height = 28
    header_text = (
        f"ROOT3POWER ENGINEERING  ·  {project_number}  ·  {set_name}"
    )
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=6)
    c = ws.cell(row=1, column=1, value=header_text)
    c.fill = _pf(_COPPER)
    c.font = Font(name="Calibri", bold=True, size=14, color="FFFFFF")
    c.alignment = _align("center", "center")

    # ── Row 2: Status summary strip ────────────────────────────
    ws.row_dimensions[2].height = 22
    status_order = [
        "READY FOR SUBMITTAL",
        "READY FOR DRAFTING",
        "IN DESIGN",
        "NOT CREATED YET",
    ]
    for i, status in enumerate(status_order):
        count = counts.get(status, 0)
        pct = round(count / total * 100) if total else 0
        st = _STATUS_STYLES.get(status, {})
        cell = ws.cell(row=2, column=i + 1, value=f"{status}: {count} ({pct}%)")
        if st:
            cell.fill = _pf(st["fill"])
            cell.font = Font(name="Calibri", bold=True, size=9, color=st["font"])
        cell.alignment = _align("center", "center")

    # Merge last two summary cols so 4 summary cells span all 6 columns
    # pattern: col1=RFS, col2=RFD, col3=IN DESIGN, col4+5+6=NCY
    ws.merge_cells(start_row=2, start_column=4, end_row=2, end_column=6)

    # ── Row 3: Blank spacer ────────────────────────────────────
    ws.row_dimensions[3].height = 8

    # ── Row 4: Column headers ──────────────────────────────────
    ws.row_dimensions[4].height = 18
    header_labels = ["#", "Drawing Number", "Description", "Revisions", "Status", "Notes"]
    for i, label in enumerate(header_labels):
        c = ws.cell(row=4, column=i + 1, value=label)
        c.fill = _pf(_BG_DARK)
        c.font = Font(name="Calibri", bold=True, size=11, color=_CREAM)
        c.alignment = _align("center", "center")
        c.border = _THIN_BORDER

    # ── Freeze panes at row 5 ─────────────────────────────────
    ws.freeze_panes = "A5"

    # ── Auto-filter on header row ──────────────────────────────
    ws.auto_filter.ref = f"A4:{col_letters[-1]}4"

    # ── Data rows ─────────────────────────────────────────────
    for idx, drawing in enumerate(drawings):
        row = idx + 5
        ws.row_dimensions[row].height = 20

        draw_num = drawing.get("drawing_number", "")
        description = drawing.get("description", "")
        status = drawing.get("status", "NOT CREATED YET")
        notes = drawing.get("notes") or "—"
        revisions = drawing.get("revisions", [])
        rev_str = _format_revisions(revisions)

        # Col 1: row number
        c1 = ws.cell(row=row, column=1, value=str(idx + 1).zfill(4))
        c1.font = Font(name="Courier New", size=9, color=_MUTED)
        c1.alignment = _align("center", "center")
        c1.border = _THIN_BORDER

        # Col 2: drawing number
        c2 = ws.cell(row=row, column=2, value=draw_num)
        c2.font = Font(name="Courier New", bold=True, size=10, color=_COPPER)
        c2.alignment = _align("left", "center")
        c2.border = _THIN_BORDER

        # Col 3: description
        c3 = ws.cell(row=row, column=3, value=description)
        c3.font = Font(name="Calibri", size=10, color=_CREAM)
        c3.alignment = _align("left", "center")
        c3.border = _THIN_BORDER

        # Col 4: revisions
        c4 = ws.cell(row=row, column=4, value=rev_str)
        c4.font = Font(name="Courier New", size=9, color=_CREAM)
        c4.alignment = _align("left", "center", wrap=True)
        c4.border = _THIN_BORDER

        # Col 5: status (colored)
        st = _STATUS_STYLES.get(status, {})
        c5 = ws.cell(row=row, column=5, value=status)
        if st:
            c5.fill = _pf(st["fill"])
            c5.font = Font(name="Calibri", bold=True, size=9, color=st["font"])
        else:
            c5.font = Font(name="Calibri", size=9, color=_CREAM)
        c5.alignment = _align("center", "center", wrap=True)
        c5.border = _THIN_BORDER

        # Col 6: notes
        c6 = ws.cell(row=row, column=6, value=notes)
        is_placeholder = notes == "—"
        c6.font = Font(
            name="Calibri",
            size=9,
            italic=True,
            color=_MUTED if is_placeholder else _CREAM,
        )
        c6.alignment = _align("left", "center", wrap=True)
        c6.border = _THIN_BORDER

        # Zebra striping (very subtle)
        if idx % 2 == 1:
            for col in range(1, 7):
                cell = ws.cell(row=row, column=col)
                if cell.fill.fgColor.rgb in ("00000000", "FFFFFFFF", "000000"):
                    cell.fill = _pf("2A2924")

    # ── Print setup ───────────────────────────────────────────
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.print_title_rows = "1:4"


# ─── Transmittal Index Export ──────────────────────────────────

def export_transmittal_index(
    path: str,
    register: dict[str, Any],
    set_name: str,
) -> None:
    """
    Write a slim .xlsx consumable by Transmittal Builder's /api/parse-index.
    Sheet: "Drawing Index"
    Columns: Drawing No. | Description | Revision (latest non-empty rev)
    Natural sort by drawing number.
    """
    # Find the requested set
    drawings: list[dict] = []
    for s in register.get("sets", []):
        if s.get("name") == set_name:
            drawings = s.get("drawings", [])
            break

    drawings = sorted(
        drawings,
        key=lambda d: _natural_sort_key(d.get("drawing_number", "")),
    )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Drawing Index"

    # Header row
    headers = ["Drawing No.", "Description", "Revision"]
    header_fills = [_pf(_BG_DARK), _pf(_BG_DARK), _pf(_BG_DARK)]
    for i, (label, fill) in enumerate(zip(headers, header_fills)):
        c = ws.cell(row=1, column=i + 1, value=label)
        c.fill = fill
        c.font = Font(name="Calibri", bold=True, size=11, color=_CREAM)
        c.alignment = _align("center", "center")
        c.border = _THIN_BORDER

    # Column widths
    ws.column_dimensions["A"].width = 24
    ws.column_dimensions["B"].width = 52
    ws.column_dimensions["C"].width = 12

    # Data rows
    for idx, drawing in enumerate(drawings):
        row = idx + 2
        ws.cell(row=row, column=1, value=drawing.get("drawing_number", ""))
        ws.cell(row=row, column=2, value=drawing.get("description", ""))
        ws.cell(row=row, column=3, value=_latest_rev(drawing.get("revisions", [])))
        for col in range(1, 4):
            ws.cell(row=row, column=col).font = Font(name="Calibri", size=10)
            ws.cell(row=row, column=col).border = _THIN_BORDER

    ws.auto_filter.ref = "A1:C1"
    ws.freeze_panes = "A2"

    wb.save(path)
