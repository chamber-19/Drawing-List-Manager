// Status glyphs — four SVGs keyed by the drawing's `status` field.
//
// status                 glyph         color
// --------------------- ------------- ---------
// NOT CREATED YET       empty ring    t3 grey
// IN DESIGN             quarter       warn amber
// READY FOR DRAFTING    half-fill     info blue
// READY FOR SUBMITTAL   filled        ok green

import { T } from "../tokens.js";

const STATUS_COLOR = {
  "NOT CREATED YET": T.t3,
  "IN DESIGN": T.warn,
  "READY FOR DRAFTING": T.info,
  "READY FOR SUBMITTAL": T.ok,
};

export function StatusGlyph({ status, size = 12 }) {
  const c = STATUS_COLOR[status] || T.t3;
  const half = size / 2;
  const r = size * 0.375;
  switch (status) {
    case "READY FOR SUBMITTAL":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={half} cy={half} r={r} fill={c} />
        </svg>
      );
    case "READY FOR DRAFTING":
      // half-filled: stroke ring + right hemisphere filled
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={half} cy={half} r={r} fill="none" stroke={c} strokeWidth="1.5" />
          <path
            d={`M ${half} ${half - r} A ${r} ${r} 0 0 1 ${half} ${half + r} Z`}
            fill={c}
          />
        </svg>
      );
    case "IN DESIGN":
      // quarter-filled: stroke ring + top-right quadrant filled
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={half} cy={half} r={r} fill="none" stroke={c} strokeWidth="1.5" />
          <path
            d={`M ${half} ${half - r} A ${r} ${r} 0 0 1 ${half + r} ${half} L ${half} ${half} Z`}
            fill={c}
          />
        </svg>
      );
    case "NOT CREATED YET":
    default:
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={half} cy={half} r={r} fill="none" stroke={c} strokeWidth="1.5" />
        </svg>
      );
  }
}

// Small chevron used in the nav tree.
export function Chevron({ open }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        textAlign: "center",
        color: T.t3,
        fontSize: 9,
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform .12s",
      }}
    >
      ▶
    </span>
  );
}
