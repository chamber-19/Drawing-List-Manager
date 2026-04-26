"""
core/project_scan.py — Walk project drawing/PDF directories and diff
against the register.

Inputs:
  marker:        the project marker dict (gives us paths)
  marker_path:   absolute path to the marker file (so relative paths in
                 marker['paths'] resolve correctly)
  register:      the loaded register dict

Outputs:
  ScanResult — structured dict (see schema below) with file inventory and
  the three diff buckets shown in the Reconcile UI.

Zero side effects beyond reading from disk. No mutation of the register.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any, TypedDict

from core.project_config import resolve_paths
from core.register import current_revision


# ─── Filename parsing ─────────────────────────────────────────────────

# Match: R3P-25074-E1-0307.dwg or R3P-25074-E1-0307_RevB.dwg etc.
# Capture the canonical drawing number (everything before any suffix or
# extension) and an optional rev label.
_FILENAME_RE = re.compile(
    r"^(?P<dn>R3P-\d+-[A-Z]\d-\d{4})"
    r"(?:[_-]Rev(?P<rev>[A-Z]+|\d+))?"
    r"\.(?P<ext>dwg|pdf)$",
    re.IGNORECASE,
)


class FileEntry(TypedDict):
    path: str            # absolute path
    filename: str        # basename
    drawing_number: str  # parsed canonical number, or "" if unparseable
    rev_label: str | None  # e.g. "A", "0", or None if filename has no rev
    extension: str       # "dwg" or "pdf"


def _scan_dir(directory: str, ext: str) -> list[FileEntry]:
    """Walk *directory* (non-recursively) for files of *ext* and parse names.

    Returns one FileEntry per file. Files whose names don't match the
    R3P drawing-number convention are still returned — with
    drawing_number="" — so the caller can surface them as orphans.
    """
    if not os.path.isdir(directory):
        return []

    out: list[FileEntry] = []
    for name in sorted(os.listdir(directory)):
        full = os.path.join(directory, name)
        if not os.path.isfile(full):
            continue
        if not name.lower().endswith("." + ext.lower()):
            continue

        m = _FILENAME_RE.match(name)
        if m:
            out.append(FileEntry(
                path=full,
                filename=name,
                drawing_number=m["dn"].upper(),
                rev_label=m["rev"].upper() if m["rev"] else None,
                extension=ext.lower(),
            ))
        else:
            out.append(FileEntry(
                path=full,
                filename=name,
                drawing_number="",
                rev_label=None,
                extension=ext.lower(),
            ))
    return out


# ─── Diff schema ──────────────────────────────────────────────────────

class MissingDwgEntry(TypedDict):
    drawing_number: str
    description: str
    status: str
    set: str


class OrphanFileEntry(TypedDict):
    filename: str
    path: str
    drawing_number: str  # parsed from filename, "" if unparseable


class StaleRevEntry(TypedDict):
    drawing_number: str
    description: str
    register_rev: str    # e.g. "B"
    pdf_rev: str | None  # e.g. "A", or None if no PDF found
    dwg_rev: str | None  # e.g. "B", or None if no DWG found


class ScanResult(TypedDict):
    scanned_at: str           # ISO timestamp
    drawings_dir: str         # absolute path scanned
    pdfs_dir: str             # absolute path scanned
    dwg_files: list[FileEntry]
    pdf_files: list[FileEntry]
    missing_dwg: list[MissingDwgEntry]    # in register, no DWG on disk
    orphan_dwg: list[OrphanFileEntry]     # DWG on disk, not in register
    orphan_pdf: list[OrphanFileEntry]     # PDF on disk, not in register
    stale_pdf: list[StaleRevEntry]        # PDF rev != register current rev


def _max_rev(revs: list[str]) -> str | None:
    """Pick the highest rev label from a list. Numeric series sort numerically;
    letter series sort lexicographically. Mixed sets fall back to lex sort."""
    if not revs:
        return None
    if all(r.isdigit() for r in revs):
        return max(revs, key=lambda r: int(r))
    return max(revs)


def scan_project(
    marker: dict[str, Any],
    marker_path: str,
    register: dict[str, Any],
) -> ScanResult:
    """Walk the project's drawing/PDF directories and diff against register.

    See module docstring for inputs/outputs.
    """
    resolved = resolve_paths(marker, marker_path)
    drawings_dir = resolved.get("drawings_dir", "")
    pdfs_dir = resolved.get("pdfs_dir", "")

    dwg_files = _scan_dir(drawings_dir, "dwg")
    pdf_files = _scan_dir(pdfs_dir, "pdf")

    # Index by drawing number for fast lookup. Multiple files for the same
    # drawing number (e.g. one per rev) are kept in a list.
    dwg_by_dn: dict[str, list[FileEntry]] = {}
    for f in dwg_files:
        if f["drawing_number"]:
            dwg_by_dn.setdefault(f["drawing_number"], []).append(f)

    pdf_by_dn: dict[str, list[FileEntry]] = {}
    for f in pdf_files:
        if f["drawing_number"]:
            pdf_by_dn.setdefault(f["drawing_number"], []).append(f)

    register_dns = {d["drawing_number"] for d in register.get("drawings", [])}

    # Missing DWG: in register, no DWG on disk.
    missing_dwg: list[MissingDwgEntry] = []
    for d in register.get("drawings", []):
        if d["drawing_number"] not in dwg_by_dn:
            missing_dwg.append(MissingDwgEntry(
                drawing_number=d["drawing_number"],
                description=d.get("description", ""),
                status=d.get("status", ""),
                set=d.get("set", ""),
            ))

    # Orphans: file on disk, no register entry. Parseable-but-unknown
    # drawing numbers and unparseable filenames both count.
    orphan_dwg: list[OrphanFileEntry] = []
    for f in dwg_files:
        if not f["drawing_number"] or f["drawing_number"] not in register_dns:
            orphan_dwg.append(OrphanFileEntry(
                filename=f["filename"],
                path=f["path"],
                drawing_number=f["drawing_number"],
            ))

    orphan_pdf: list[OrphanFileEntry] = []
    for f in pdf_files:
        if not f["drawing_number"] or f["drawing_number"] not in register_dns:
            orphan_pdf.append(OrphanFileEntry(
                filename=f["filename"],
                path=f["path"],
                drawing_number=f["drawing_number"],
            ))

    # Stale PDF: register has a current rev, but the PDF rev (if any)
    # doesn't match. Drawings with no revisions in the register skip this
    # check — there's no canonical rev to compare against.
    stale_pdf: list[StaleRevEntry] = []
    for d in register.get("drawings", []):
        cur = current_revision(d)
        if cur is None:
            continue
        register_rev = cur.get("rev", "")
        dn = d["drawing_number"]

        pdf_rev: str | None = None
        if dn in pdf_by_dn:
            revs = [f["rev_label"] for f in pdf_by_dn[dn] if f["rev_label"]]
            pdf_rev = _max_rev(revs)

        dwg_rev: str | None = None
        if dn in dwg_by_dn:
            revs = [f["rev_label"] for f in dwg_by_dn[dn] if f["rev_label"]]
            dwg_rev = _max_rev(revs)

        if pdf_rev != register_rev:
            stale_pdf.append(StaleRevEntry(
                drawing_number=dn,
                description=d.get("description", ""),
                register_rev=register_rev,
                pdf_rev=pdf_rev,
                dwg_rev=dwg_rev,
            ))

    return ScanResult(
        scanned_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        drawings_dir=drawings_dir,
        pdfs_dir=pdfs_dir,
        dwg_files=dwg_files,
        pdf_files=pdf_files,
        missing_dwg=missing_dwg,
        orphan_dwg=orphan_dwg,
        orphan_pdf=orphan_pdf,
        stale_pdf=stale_pdf,
    )
