"""
core/folder_scan.py — Scan a project drawings folder for .dwg and .pdf files.

Used at project-creation time and on-demand re-scan to populate and update
the drawing register with file-backed entries.

Inputs:
    drawings_root: absolute path to the folder containing .dwg files.

Outputs:
    FolderScanResult — structured dict (see schema below) with file inventory
    and pairing results.

Zero side effects beyond reading from disk. No mutation of the register.

PDF sub-directory convention
-----------------------------
PDFs are expected in a sub-directory of drawings_root whose name is ``pdf``
(case-insensitive).  The directory may also be named ``PDFs``/``pdfs``/etc.
This matches the common practitioner convention of keeping issued PDFs
alongside their source DWGs in a dedicated sub-folder.

Matching
--------
Drawings and PDFs are matched by **filename stem** (the portion of the
filename before the extension), compared case-insensitively.  A drawing file
``E0-001.dwg`` will pair with ``e0-001.PDF`` in the pdf sub-directory.
"""

from __future__ import annotations

import logging
import os
from typing import TypedDict

logger = logging.getLogger(__name__)


# ─── Data types ───────────────────────────────────────────────────────────────


class FileInfo(TypedDict):
    filename: str        # basename, e.g. "E0-001.dwg"
    stem: str            # name without extension, e.g. "E0-001"
    path: str            # absolute path


class MatchedPair(TypedDict):
    drawing: FileInfo
    pdf: FileInfo


class FolderScanResult(TypedDict):
    drawings_root: str               # absolute path scanned
    pdf_dir: str | None              # absolute path to pdf sub-dir, or None
    pdf_dir_found: bool              # was the pdf/ sub-directory present?
    drawings: list[FileInfo]         # all .dwg files found
    pdfs: list[FileInfo]             # all .pdf files found
    matched: list[MatchedPair]       # (drawing, pdf) pairs matched by stem
    drawings_without_pdfs: list[FileInfo]  # drawings with no matching PDF
    pdfs_without_drawings: list[FileInfo]  # PDFs with no matching drawing


# ─── Internal helpers ─────────────────────────────────────────────────────────


def _find_pdf_subdir(drawings_root: str) -> str | None:
    """Return the absolute path of the pdf subdirectory in *drawings_root*.

    Accepts any case variant of ``pdf`` or ``pdfs`` (e.g. ``PDF``, ``Pdf``,
    ``PDFs``).  Returns the first match found, or ``None`` if absent.
    """
    try:
        entries = os.listdir(drawings_root)
    except OSError:
        return None

    for name in entries:
        if name.lower() in ("pdf", "pdfs"):
            candidate = os.path.join(drawings_root, name)
            if os.path.isdir(candidate):
                return candidate

    return None


def _scan_for_ext(directory: str, ext: str) -> list[FileInfo]:
    """Return a list of FileInfo for all files with *ext* in *directory*.

    Top-level only — sub-directories are not recursed into.
    Skips hidden files (names starting with ``"."``).
    Skips files that are not readable (logs a warning and continues).
    """
    ext_lower = ext.lower().lstrip(".")
    out: list[FileInfo] = []

    try:
        names = sorted(os.listdir(directory))
    except OSError as exc:
        logger.warning("Cannot list directory %r: %s", directory, exc)
        return out

    for name in names:
        # Skip hidden files.
        if name.startswith("."):
            continue

        # Extension check (case-insensitive).
        root_part, dot_ext = os.path.splitext(name)
        if dot_ext.lower().lstrip(".") != ext_lower:
            continue

        full_path = os.path.join(directory, name)

        # Directories with the right extension suffix are not files.
        if not os.path.isfile(full_path):
            continue

        # Verify readability.
        if not os.access(full_path, os.R_OK):
            logger.warning("Skipping unreadable file: %r", full_path)
            continue

        out.append(
            FileInfo(
                filename=name,
                stem=root_part,
                path=full_path,
            )
        )

    return out


# ─── Public API ───────────────────────────────────────────────────────────────


def scan_drawings_folder(drawings_root: str) -> FolderScanResult:
    """Scan a project drawings folder for .dwg and .pdf files.

    Parameters
    ----------
    drawings_root:
        Absolute path to the project's drawings root directory.

    Returns
    -------
    FolderScanResult with:

    - ``drawings``            — list of FileInfo for each .dwg found
    - ``pdfs``                — list of FileInfo for each .pdf found
    - ``matched``             — list of (drawing, pdf) pairs matched by stem
    - ``drawings_without_pdfs`` — drawings with no matching PDF
    - ``pdfs_without_drawings`` — PDFs with no matching drawing
    - ``pdf_dir_found``       — whether the pdf/ sub-directory was present

    Behaviour
    ---------
    - Scans *drawings_root*/ for ``*.dwg`` at top-level only.
    - Finds the ``pdf/`` sub-directory (case-insensitive name: ``pdf``,
      ``PDF``, ``Pdf``, ``PDFs``, …) and scans it for ``*.pdf``.
    - Matches by filename stem, case-insensitively.
    - If the pdf/ sub-directory is missing, returns an empty ``pdfs`` list
      and sets ``pdf_dir_found=False`` (not an error).
    - Skips hidden files (names starting with ``"."``).
    - Skips files that aren't readable (logs a warning and continues).
    - If *drawings_root* itself is missing/unreadable, returns all-empty
      lists and ``pdf_dir_found=False``.
    """
    drawings_root = os.path.abspath(drawings_root)

    # Scan top-level for .dwg files.
    drawings: list[FileInfo] = []
    if os.path.isdir(drawings_root):
        drawings = _scan_for_ext(drawings_root, "dwg")

    # Locate the pdf sub-directory (case-insensitive).
    pdf_dir: str | None = _find_pdf_subdir(drawings_root) if os.path.isdir(drawings_root) else None
    pdf_dir_found = pdf_dir is not None

    # Scan the pdf sub-directory for .pdf files.
    pdfs: list[FileInfo] = []
    if pdf_dir_found and pdf_dir is not None:
        pdfs = _scan_for_ext(pdf_dir, "pdf")

    # Build stem-indexed dicts (case-insensitive keys) for O(1) matching.
    # If multiple files share the same stem (unlikely but possible after
    # case-fold), the last one wins.
    dwg_by_stem: dict[str, FileInfo] = {
        d["stem"].lower(): d for d in drawings
    }
    pdf_by_stem: dict[str, FileInfo] = {
        p["stem"].lower(): p for p in pdfs
    }

    matched: list[MatchedPair] = []
    drawings_without_pdfs: list[FileInfo] = []
    pdfs_without_drawings: list[FileInfo] = []

    for dwg in drawings:
        key = dwg["stem"].lower()
        if key in pdf_by_stem:
            matched.append(MatchedPair(drawing=dwg, pdf=pdf_by_stem[key]))
        else:
            drawings_without_pdfs.append(dwg)

    matched_dwg_stems = {pair["drawing"]["stem"].lower() for pair in matched}
    for pdf in pdfs:
        if pdf["stem"].lower() not in matched_dwg_stems:
            pdfs_without_drawings.append(pdf)

    return FolderScanResult(
        drawings_root=drawings_root,
        pdf_dir=pdf_dir,
        pdf_dir_found=pdf_dir_found,
        drawings=drawings,
        pdfs=pdfs,
        matched=matched,
        drawings_without_pdfs=drawings_without_pdfs,
        pdfs_without_drawings=pdfs_without_drawings,
    )
