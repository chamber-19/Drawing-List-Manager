// FolderScanPanel — "needs attention" section shown in the drawings view.
//
// Displays:
//   - Count and list of drawings without matching PDFs
//   - Count and list of PDFs without matching drawings (orphan PDFs)
//   - A note when pdf_dir_found is false (no pdf/ subdirectory found)
//   - A "Re-scan folder" button in the section header
//
// Entirely hidden when both mismatch lists are empty AND pdf_dir_found is true.
// Uses only existing T.* design tokens — no new design system tokens.

import { useState } from "react";
import { T } from "../tokens.js";

function SectionHeader({ label, count, color, expanded, onToggle, action }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        background: T.bgEl,
        borderBottom: `1px solid ${T.bdSoft}`,
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={onToggle}
    >
      <span
        style={{
          fontFamily: T.fMono,
          fontSize: 9,
          color: T.t3,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          flex: 1,
        }}
      >
        {label}
      </span>
      {count > 0 && (
        <span
          style={{
            fontFamily: T.fMono,
            fontSize: 10,
            color,
            background: color + "22",
            padding: "1px 7px",
            borderRadius: 8,
          }}
        >
          {count}
        </span>
      )}
      {action}
      <span style={{ color: T.t4, fontSize: 11 }}>{expanded ? "▲" : "▼"}</span>
    </div>
  );
}

function FileRow({ name, note, noteColor }) {
  return (
    <div
      style={{
        padding: "5px 14px",
        borderBottom: `1px solid ${T.bdSoft}`,
        fontSize: 12,
      }}
    >
      <span style={{ fontFamily: T.fMono, color: T.t2 }}>{name}</span>
      {note && (
        <span
          style={{
            marginLeft: 10,
            color: noteColor || T.t3,
            fontSize: 11,
          }}
        >
          {note}
        </span>
      )}
    </div>
  );
}

export default function FolderScanPanel({ folderScan, onRescan, rescanning }) {
  const [openSection, setOpenSection] = useState(null);

  if (!folderScan) return null;

  const { pdf_dir_found, drawings_without_pdfs, pdfs_without_drawings } = folderScan;

  const hasDrawingsMissingPdf = drawings_without_pdfs.length > 0;
  const hasOrphanPdfs = pdfs_without_drawings.length > 0;
  const showNoPdfDirNote = !pdf_dir_found;

  // Hide entirely when there is nothing to surface.
  if (!hasDrawingsMissingPdf && !hasOrphanPdfs && !showNoPdfDirNote) return null;

  function toggle(key) {
    setOpenSection((prev) => (prev === key ? null : key));
  }

  const rescanBtn = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRescan();
      }}
      disabled={rescanning}
      title="Re-scan drawings folder for new or matched files"
      style={{
        padding: "2px 8px",
        background: "transparent",
        border: `1px solid ${T.bdSoft}`,
        borderRadius: T.rSm,
        color: rescanning ? T.t4 : T.t2,
        fontFamily: T.fMono,
        fontSize: 9,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: rescanning ? "not-allowed" : "pointer",
      }}
    >
      {rescanning ? "Scanning…" : "Re-scan folder"}
    </button>
  );

  return (
    <div
      style={{
        borderTop: `2px solid ${T.warn}`,
        background: T.bgCard,
        flexShrink: 0,
      }}
    >
      {/* Panel header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "6px 12px",
          borderBottom: `1px solid ${T.bdSoft}`,
        }}
      >
        <span
          style={{
            fontFamily: T.fMono,
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.warn,
          }}
        >
          Needs attention
        </span>
        <span style={{ color: T.t4, fontSize: 11, flex: 1 }}>
          {showNoPdfDirNote
            ? "No pdf/ subdirectory found"
            : "Folder scan found mismatches"}
        </span>
        {rescanBtn}
      </div>

      {/* No pdf/ subdir note */}
      {showNoPdfDirNote && (
        <div
          style={{
            padding: "8px 14px",
            fontSize: 12,
            color: T.t3,
            borderBottom: `1px solid ${T.bdSoft}`,
          }}
        >
          No{" "}
          <code
            style={{
              fontFamily: T.fMono,
              color: T.t2,
              background: T.bgEl,
              padding: "1px 4px",
              borderRadius: 3,
            }}
          >
            pdf/
          </code>{" "}
          subdirectory found in the drawings folder. Create one and re-scan to
          match PDFs.
        </div>
      )}

      {/* Drawings without PDFs */}
      {hasDrawingsMissingPdf && (
        <div>
          <SectionHeader
            label="Drawings without PDF"
            count={drawings_without_pdfs.length}
            color={T.warn}
            expanded={openSection === "noPdf"}
            onToggle={() => toggle("noPdf")}
          />
          {openSection === "noPdf" && (
            <div style={{ maxHeight: 160, overflowY: "auto" }}>
              {drawings_without_pdfs.map((d) => (
                <FileRow
                  key={d.path}
                  name={d.filename}
                  note="no matching PDF"
                  noteColor={T.t3}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Orphan PDFs */}
      {hasOrphanPdfs && (
        <div>
          <SectionHeader
            label="PDFs without drawing"
            count={pdfs_without_drawings.length}
            color={T.info}
            expanded={openSection === "orphanPdf"}
            onToggle={() => toggle("orphanPdf")}
          />
          {openSection === "orphanPdf" && (
            <div style={{ maxHeight: 160, overflowY: "auto" }}>
              {pdfs_without_drawings.map((p) => (
                <FileRow
                  key={p.path}
                  name={p.filename}
                  note="no matching drawing"
                  noteColor={T.t3}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
