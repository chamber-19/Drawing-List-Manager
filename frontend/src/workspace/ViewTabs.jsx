// View tab strip: Drawings | Reconcile (with issue badge) | Export.

import { T } from "../tokens.js";

function Tab({ active, onClick, children, badge, disabled }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      title={disabled ? "Coming next slice" : undefined}
      style={{
        background: "transparent",
        border: "none",
        borderBottom: `2px solid ${active ? T.acc : "transparent"}`,
        color: active ? T.t1 : disabled ? T.t4 : T.t2,
        fontFamily: T.fMono,
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "11px 18px",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        transition: "color .12s, border-color .12s",
      }}
    >
      {children}
      {badge != null && badge > 0 ? (
        <span
          style={{
            background: T.warn + "33",
            color: T.warn,
            padding: "1px 6px",
            borderRadius: 8,
            fontSize: 10,
            letterSpacing: "0.04em",
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export default function ViewTabs({ active, onChange, issueCount }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: "0 24px",
        borderBottom: `1px solid ${T.bd}`,
        background: T.bgEl,
        flexShrink: 0,
      }}
    >
      <Tab active={active === "drawings"} onClick={() => onChange("drawings")}>
        Drawings
      </Tab>
      <Tab
        active={active === "reconcile"}
        onClick={() => onChange("reconcile")}
        badge={issueCount}
      >
        Reconcile
      </Tab>
      <Tab active={active === "export"} onClick={() => onChange("export")} disabled>
        Export
      </Tab>
    </div>
  );
}
