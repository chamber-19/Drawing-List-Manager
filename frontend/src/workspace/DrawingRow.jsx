// One row inside a band card. Grid layout:
//   [checkbox][status glyph][drawing_number][description][set tag][rev display]

import { T } from "../tokens.js";
import { StatusGlyph } from "./glyphs.jsx";

function formatRev(d) {
  const revs = d.revisions || [];
  if (revs.length === 0) return null;
  const r = revs[revs.length - 1];
  return r;
}

export default function DrawingRow({ drawing, selected, onClick, orderedIds }) {
  const r = formatRev(drawing);
  return (
    <div
      onClick={(e) =>
        onClick(drawing.drawing_number, {
          shift: e.shiftKey,
          cmd: e.metaKey || e.ctrlKey,
          orderedIds,
        })
      }
      className="dlm-hoverable"
      style={{
        display: "grid",
        gridTemplateColumns: "20px 16px 170px 1fr 90px 200px",
        gap: 12,
        alignItems: "center",
        padding: "8px 14px",
        background: selected ? T.accGlow : "transparent",
        borderLeft: `2px solid ${selected ? T.acc : "transparent"}`,
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          border: `1.5px solid ${selected ? T.acc : T.bdStrong}`,
          borderRadius: 3,
          background: selected ? T.acc : "transparent",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: T.tOn,
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        {selected ? "✓" : ""}
      </span>
      <StatusGlyph status={drawing.status} />
      <span style={{ fontFamily: T.fMono, fontSize: 12, color: T.t1 }}>
        {drawing.drawing_number}
      </span>
      <span style={{ color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {drawing.description}
      </span>
      <span>
        <span
          style={{
            fontFamily: T.fMono,
            fontSize: 10,
            padding: "2px 6px",
            borderRadius: 3,
            background: drawing.set === "P&C" ? T.accGlow : T.info + "22",
            color: drawing.set === "P&C" ? T.acc : T.info,
            letterSpacing: "0.04em",
          }}
        >
          {drawing.set}
        </span>
      </span>
      <span
        style={{
          fontFamily: T.fMono,
          fontSize: 11,
          color: T.t2,
          display: "inline-flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        {r ? (
          <>
            {r.phase === "IFA" && r.percent != null && (
              <span style={{ color: T.t1 }}>{r.percent}%</span>
            )}
            <span style={{ color: T.acc }}>{r.phase}</span>
            <span style={{ color: T.t1 }}>Rev {r.rev}</span>
            <span style={{ color: T.t3 }}>{(r.date || "").slice(5)}</span>
          </>
        ) : (
          <span style={{ fontStyle: "italic", color: T.t4 }}>No revisions yet</span>
        )}
      </span>
    </div>
  );
}
