// Bottom-docked inspector. Shows single-drawing details on size === 1
// (now editable: description, notes, status, set + Mark superseded),
// bulk summary + working action buttons on size > 1, hidden on size === 0.

import { useEffect } from "react";
import { T } from "../tokens.js";
import { StatusGlyph } from "./glyphs.jsx";
import EditableField from "./EditableField.jsx";

const STATUSES = [
  "NOT CREATED YET",
  "IN DESIGN",
  "READY FOR DRAFTING",
  "READY FOR SUBMITTAL",
];
const SETS = ["P&C", "Physicals"];

function Section({ label, children, action }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontFamily: T.fMono,
          fontSize: 9,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: T.t3,
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
        }}
      >
        <span>{label}</span>
        {action && <span style={{ marginLeft: "auto" }}>{action}</span>}
      </div>
      <div style={{ color: T.t1 }}>{children}</div>
    </div>
  );
}

function FilesGrid({ dn, scan }) {
  if (!scan) return <div style={{ color: T.t3 }}>scan pending…</div>;
  const dwg = scan.dwg_files.filter((f) => f.drawing_number === dn);
  const pdf = scan.pdf_files.filter((f) => f.drawing_number === dn);
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <FileCard kind="DWG" files={dwg} color={T.ok} />
      <FileCard kind="PDF" files={pdf} color={T.info} />
    </div>
  );
}

function FileCard({ kind, files, color }) {
  const found = files.length > 0;
  return (
    <div
      style={{
        flex: 1,
        padding: 10,
        background: T.bg,
        border: `1px solid ${found ? T.bdSoft : T.bd}`,
        borderRadius: T.rSm,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: T.fMono,
          fontSize: 11,
          color: found ? color : T.t4,
          marginBottom: 6,
        }}
      >
        <span>{kind}</span>
        <span style={{ marginLeft: "auto", color: T.t3 }}>
          {found ? `${files.length} found` : "missing"}
        </span>
      </div>
      {found ? (
        files.map((f) => (
          <div
            key={f.path}
            style={{ fontFamily: T.fMono, fontSize: 10, color: T.t2, lineHeight: 1.4 }}
          >
            {f.filename}
          </div>
        ))
      ) : (
        <div style={{ fontStyle: "italic", color: T.t4, fontSize: 11 }}>—</div>
      )}
    </div>
  );
}

function compactSelect(value, onChange, options) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: T.bg,
        border: `1px solid ${T.bd}`,
        color: T.t1,
        padding: "4px 8px",
        borderRadius: T.rSm,
        font: "inherit",
        fontSize: 12,
        outline: "none",
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function SingleInspector({ drawing, scan, onUpdateField, onMarkSuperseded }) {
  const cur = (drawing.revisions || [])[drawing.revisions.length - 1];
  const dn = drawing.drawing_number;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, height: "100%" }}>
      <div style={{ overflowY: "auto", paddingRight: 12 }}>
        <Section label="Drawing">
          <div style={{ fontFamily: T.fMono, color: T.acc, fontSize: 14 }}>{dn}</div>
          <div style={{ marginTop: 4 }}>
            <EditableField
              value={drawing.description}
              onCommit={(v) => onUpdateField(dn, { description: v })}
              placeholder="(no description)"
            />
          </div>
        </Section>
        <Section label="Band">
          <span style={{ color: T.t2, fontFamily: T.fMono, fontSize: 12 }}>
            {drawing._parsed?.band?.label || "—"}
            {drawing._parsed?.band &&
              ` · ${String(drawing._parsed.band.start).padStart(4, "0")}-${String(drawing._parsed.band.end).padStart(4, "0")}`}
          </span>
        </Section>
        <Section label="Status">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <StatusGlyph status={drawing.status} />
            {compactSelect(drawing.status, (v) => onUpdateField(dn, { status: v }), STATUSES)}
          </span>
        </Section>
        <Section label="Set">
          {compactSelect(drawing.set, (v) => onUpdateField(dn, { set: v }), SETS)}
        </Section>
        <Section label="Current revision">
          {cur ? (
            <span style={{ fontFamily: T.fMono, fontSize: 12 }}>
              {cur.phase === "IFA" && cur.percent != null && `${cur.percent}% `}
              <span style={{ color: T.acc }}>{cur.phase}</span> Rev {cur.rev} · {cur.date}
            </span>
          ) : (
            <span style={{ fontStyle: "italic", color: T.t4 }}>No revisions yet</span>
          )}
        </Section>
        <Section label="Notes">
          <EditableField
            value={drawing.notes || ""}
            onCommit={(v) => onUpdateField(dn, { notes: v.trim() ? v : null })}
            placeholder="(no notes — click to add)"
            multiline
          />
        </Section>
        <Section label={`Revision history (${(drawing.revisions || []).length})`}>
          {(drawing.revisions || []).length === 0 ? (
            <span style={{ fontStyle: "italic", color: T.t4 }}>—</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {drawing.revisions.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 60px 80px 1fr",
                    gap: 12,
                    fontFamily: T.fMono,
                    fontSize: 11,
                    color: T.t2,
                  }}
                >
                  <span style={{ color: T.acc }}>{r.phase}</span>
                  <span style={{ color: T.t1 }}>Rev {r.rev}</span>
                  <span>{r.date}</span>
                  <span>{r.percent != null ? `${r.percent}%` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
        {drawing.superseded && (
          <Section label="Status flag">
            <span
              style={{
                fontFamily: T.fMono,
                fontSize: 11,
                color: T.warn,
                padding: "2px 8px",
                border: `1px solid ${T.warn}`,
                borderRadius: T.rSm,
              }}
            >
              SUPERSEDED
            </span>
          </Section>
        )}
        {!drawing.superseded && (
          <button
            type="button"
            onClick={() => onMarkSuperseded([dn])}
            style={{
              marginTop: 4,
              padding: "6px 12px",
              background: "transparent",
              border: `1px solid ${T.bdSoft}`,
              color: T.t2,
              borderRadius: T.rSm,
              fontFamily: T.fMono,
              fontSize: 11,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Mark superseded…
          </button>
        )}
      </div>
      <div style={{ overflowY: "auto", paddingLeft: 12, borderLeft: `1px solid ${T.bdSoft}` }}>
        <Section label="Files on disk">
          <FilesGrid dn={dn} scan={scan} />
        </Section>
      </div>
    </div>
  );
}

function BulkInspector({
  drawings,
  scan,
  onClear,
  onAdvanceRev,
  onSetStatus,
  onMarkSuperseded,
}) {
  const sets = new Set(drawings.map((d) => d.set));
  const statuses = new Set(drawings.map((d) => d.status));
  const phases = new Set(
    drawings.map((d) => (d.revisions || []).slice(-1)[0]?.phase).filter(Boolean),
  );
  const filesCount =
    scan
      ? drawings.reduce((acc, d) => {
          const dwg = scan.dwg_files.filter((f) => f.drawing_number === d.drawing_number).length;
          const pdf = scan.pdf_files.filter((f) => f.drawing_number === d.drawing_number).length;
          return acc + dwg + pdf;
        }, 0)
      : 0;

  function Cell({ k, v }) {
    return (
      <div>
        <div style={{ fontFamily: T.fMono, fontSize: 9, color: T.t3, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {k}
        </div>
        <div style={{ fontSize: 13, color: T.t1, marginTop: 2 }}>{v}</div>
      </div>
    );
  }

  function ActionBtn({ children, onClick, danger }) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          padding: "8px 14px",
          border: `1px solid ${danger ? T.err : T.bd}`,
          borderRadius: T.rSm,
          background: T.bgEl,
          color: danger ? T.err : T.t1,
          fontFamily: T.fMono,
          fontSize: 11,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        {children}
      </button>
    );
  }

  const targets = drawings.map((d) => d.drawing_number);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, height: "100%" }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <span style={{ fontFamily: T.fDisp, fontSize: 30, color: T.acc, lineHeight: 1 }}>
            {drawings.length}
          </span>
          <span style={{ color: T.t2 }}>drawings selected</span>
          <button
            type="button"
            onClick={onClear}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: `1px solid ${T.bdSoft}`,
              borderRadius: T.rSm,
              color: T.t3,
              fontFamily: T.fMono,
              fontSize: 10,
              padding: "4px 10px",
              cursor: "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Clear
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Cell k="Sets" v={sets.size === 1 ? [...sets][0] : `mixed (${sets.size})`} />
          <Cell k="Statuses" v={statuses.size === 1 ? [...statuses][0] : `mixed (${statuses.size})`} />
          <Cell k="Phases" v={phases.size === 0 ? "—" : phases.size === 1 ? [...phases][0] : `mixed (${phases.size})`} />
          <Cell k="Files on disk" v={filesCount} />
        </div>
      </div>
      <div style={{ paddingLeft: 12, borderLeft: `1px solid ${T.bdSoft}` }}>
        <div style={{ fontFamily: T.fMono, fontSize: 9, color: T.t3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          Bulk actions
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch" }}>
          <ActionBtn onClick={onAdvanceRev}>Advance to next rev…</ActionBtn>
          <ActionBtn onClick={onSetStatus}>Set status…</ActionBtn>
          <ActionBtn danger onClick={() => onMarkSuperseded(targets)}>
            Mark superseded…
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

export default function Inspector({
  register,
  selection,
  scan,
  onClear,
  onUpdateField,
  onMarkSuperseded,
  onAdvanceRev,
  onSetStatus,
}) {
  // Escape clears selection.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        // Don't steal focus from inputs / modals — only clear if focus
        // is on the body or a non-text element.
        const t = document.activeElement;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) {
          return;
        }
        onClear();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClear]);

  if (selection.size === 0) return null;
  const drawings = (register?.drawings || []).filter((d) =>
    selection.has(d.drawing_number),
  );
  if (drawings.length === 0) return null;

  return (
    <div
      style={{
        height: 320,
        flexShrink: 0,
        borderTop: `1px solid ${T.bd}`,
        background: T.bgEl,
        padding: 20,
        overflow: "hidden",
      }}
    >
      {drawings.length === 1 ? (
        <SingleInspector
          drawing={drawings[0]}
          scan={scan}
          onUpdateField={onUpdateField}
          onMarkSuperseded={onMarkSuperseded}
        />
      ) : (
        <BulkInspector
          drawings={drawings}
          scan={scan}
          onClear={onClear}
          onAdvanceRev={onAdvanceRev}
          onSetStatus={onSetStatus}
          onMarkSuperseded={onMarkSuperseded}
        />
      )}
    </div>
  );
}
