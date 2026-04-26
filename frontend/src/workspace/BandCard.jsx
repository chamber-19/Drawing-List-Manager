// One band card — header (range, label, fill progress, n/m active) +
// body of DrawingRow + footer with "next free" hint and disabled
// "Add in this band" button.

import { useMemo } from "react";
import { T } from "../tokens.js";
import DrawingRow from "./DrawingRow.jsx";

function nextFreeRanges(seqsInUse, start, end) {
  if (start == null) return "—";
  const used = new Set(seqsInUse);
  const ranges = [];
  let runStart = null;
  for (let i = start; i <= end + 1; i++) {
    if (i <= end && !used.has(i)) {
      if (runStart == null) runStart = i;
    } else if (runStart != null) {
      const last = i - 1;
      ranges.push(
        runStart === last
          ? String(runStart).padStart(4, "0")
          : `${String(runStart).padStart(4, "0")}-${String(last).padStart(4, "0")}`,
      );
      runStart = null;
      if (ranges.length >= 3) break;
    }
  }
  return ranges.length ? ranges.join(", ") : "(band full)";
}

export default function BandCard({
  band,
  drawings,
  selection,
  onToggleSelect,
  orderedIds,
  focused,
  onAddInBand,
}) {
  const activeCount = drawings.filter((d) => (d.revisions || []).length > 0).length;
  const total = band.start != null ? band.end - band.start + 1 : drawings.length;
  const filled = drawings.length;
  const pct = total > 0 ? Math.round((activeCount / total) * 100) : 0;

  const nextFree = useMemo(() => {
    if (band.start == null) return "—";
    const seqs = drawings
      .map((d) => d._parsed?.seq)
      .filter((s) => typeof s === "number");
    return nextFreeRanges(seqs, band.start, band.end);
  }, [drawings, band]);

  return (
    <div
      style={{
        background: T.bgCard,
        border: `1px solid ${focused ? T.acc : T.bdSoft}`,
        borderRadius: T.r,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 16px",
          borderBottom: `1px solid ${T.bdSoft}`,
          background: T.bgEl,
        }}
      >
        <span style={{ fontFamily: T.fMono, fontSize: 12, color: T.acc }}>
          {band.start != null
            ? `${String(band.start).padStart(4, "0")}-${String(band.end).padStart(4, "0")}`
            : "Unbanded"}
        </span>
        <span style={{ width: 4, height: 4, borderRadius: 2, background: T.t4 }} />
        <span style={{ fontFamily: T.fDisp, fontSize: 16, color: T.t1, letterSpacing: "-0.01em" }}>
          {band.label}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <span
            style={{
              width: 80,
              height: 4,
              background: T.bd,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "block",
                width: `${pct}%`,
                height: "100%",
                background: T.acc,
              }}
            />
          </span>
          <span style={{ fontFamily: T.fMono, fontSize: 11, color: T.t2 }}>{pct}%</span>
          <span style={{ fontFamily: T.fMono, fontSize: 11, color: T.t3 }}>
            <span style={{ color: T.t1 }}>{activeCount}</span>/{filled} active
          </span>
        </div>
      </div>

      <div>
        {drawings.map((d) => (
          <DrawingRow
            key={d.drawing_number}
            drawing={d}
            selected={selection.has(d.drawing_number)}
            onClick={onToggleSelect}
            orderedIds={orderedIds}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 16px",
          borderTop: `1px solid ${T.bdSoft}`,
          background: T.bg,
          fontFamily: T.fMono,
          fontSize: 11,
          color: T.t3,
        }}
      >
        <span>↳ next free {nextFree}</span>
        <button
          type="button"
          disabled={!onAddInBand || band.start == null}
          onClick={onAddInBand}
          title={
            band.start == null
              ? "Cannot add into an unbanded group"
              : `Add a new drawing in ${band.label}`
          }
          style={{
            marginLeft: "auto",
            padding: "5px 10px",
            background: "transparent",
            border: `1px dashed ${onAddInBand && band.start != null ? T.acc : T.bdSoft}`,
            borderRadius: T.rSm,
            color: onAddInBand && band.start != null ? T.acc : T.t3,
            fontFamily: T.fMono,
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: onAddInBand && band.start != null ? "pointer" : "not-allowed",
            opacity: onAddInBand && band.start != null ? 1 : 0.6,
          }}
        >
          + Add in this band
        </button>
      </div>
    </div>
  );
}
