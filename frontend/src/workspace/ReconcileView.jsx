// Reconcile view — three cards comparing register vs disk.
//
// missing_dwg  → "In register · no DWG"   (severe, red border)
// orphan_dwg   → "DWG · no register entry" (warn, yellow border)
// stale_pdf    → "PDF stale for current rev" (warn, yellow border)
//
// Each row is clickable: invokes onJump(drawing_number) so the parent can
// switch back to the drawings tab and select the row in its band.

import { T } from "../tokens.js";

function Card({ title, count, color, children }) {
  return (
    <div
      style={{
        background: T.bgCard,
        border: `1px solid ${T.bdSoft}`,
        borderTop: `3px solid ${color}`,
        borderRadius: T.r,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          borderBottom: `1px solid ${T.bdSoft}`,
          background: T.bgEl,
        }}
      >
        <span style={{ fontFamily: T.fDisp, fontSize: 16, color: T.t1, letterSpacing: "-0.01em" }}>
          {title}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: T.fMono,
            fontSize: 11,
            color: color,
            background: color + "22",
            padding: "2px 8px",
            borderRadius: 10,
          }}
        >
          {count}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
    </div>
  );
}

function Empty() {
  return (
    <div
      style={{
        padding: 24,
        textAlign: "center",
        color: T.t4,
        fontStyle: "italic",
        fontSize: 12,
      }}
    >
      Nothing to reconcile.
    </div>
  );
}

function Row({ children, onClick, title }) {
  return (
    <div
      onClick={onClick}
      title={title}
      className="dlm-hoverable"
      style={{
        padding: "10px 14px",
        borderBottom: `1px solid ${T.bdSoft}`,
        cursor: onClick ? "pointer" : "default",
        fontSize: 12,
      }}
    >
      {children}
    </div>
  );
}

export default function ReconcileView({ scan, onJump }) {
  if (!scan) {
    return (
      <div style={{ padding: 32, color: T.t3, fontStyle: "italic" }}>
        Scan pending…
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 16,
        padding: 20,
        flex: 1,
        minHeight: 0,
      }}
    >
      <Card
        title="In register · no DWG"
        count={scan.missing_dwg.length}
        color={T.err}
      >
        {scan.missing_dwg.length === 0 ? (
          <Empty />
        ) : (
          scan.missing_dwg.map((m) => (
            <Row
              key={m.drawing_number}
              onClick={() => onJump(m.drawing_number)}
              title="Jump to drawing"
            >
              <div style={{ fontFamily: T.fMono, color: T.acc }}>{m.drawing_number}</div>
              <div style={{ color: T.t2, marginTop: 2 }}>{m.description}</div>
              <div style={{ color: T.t3, marginTop: 2, fontSize: 11 }}>
                {m.set} · {m.status}
              </div>
            </Row>
          ))
        )}
      </Card>

      <Card
        title="DWG · no register entry"
        count={scan.orphan_dwg.length}
        color={T.warn}
      >
        {scan.orphan_dwg.length === 0 ? (
          <Empty />
        ) : (
          scan.orphan_dwg.map((o) => (
            <Row
              key={o.path}
              onClick={o.drawing_number ? () => onJump(o.drawing_number) : undefined}
              title={o.path}
            >
              <div style={{ fontFamily: T.fMono, color: T.t1 }}>{o.filename}</div>
              {o.drawing_number ? (
                <div style={{ color: T.t3, marginTop: 2, fontSize: 11 }}>
                  parsed as <span style={{ color: T.acc }}>{o.drawing_number}</span>
                </div>
              ) : (
                <div style={{ color: T.err, marginTop: 2, fontSize: 11 }}>
                  unparseable filename
                </div>
              )}
            </Row>
          ))
        )}
      </Card>

      <Card
        title="PDF stale for current rev"
        count={scan.stale_pdf.length}
        color={T.warn}
      >
        {scan.stale_pdf.length === 0 ? (
          <Empty />
        ) : (
          scan.stale_pdf.map((s) => (
            <Row
              key={s.drawing_number}
              onClick={() => onJump(s.drawing_number)}
              title="Jump to drawing"
            >
              <div style={{ fontFamily: T.fMono, color: T.acc }}>{s.drawing_number}</div>
              <div style={{ color: T.t2, marginTop: 2 }}>{s.description}</div>
              <div
                style={{
                  color: T.t3,
                  marginTop: 4,
                  fontSize: 11,
                  fontFamily: T.fMono,
                  display: "flex",
                  gap: 12,
                }}
              >
                <span>
                  register Rev <span style={{ color: T.t1 }}>{s.register_rev}</span>
                </span>
                <span>
                  PDF Rev{" "}
                  <span style={{ color: s.pdf_rev ? T.warn : T.err }}>
                    {s.pdf_rev ?? "—"}
                  </span>
                </span>
                {s.dwg_rev && (
                  <span>
                    DWG Rev <span style={{ color: T.t2 }}>{s.dwg_rev}</span>
                  </span>
                )}
              </div>
            </Row>
          ))
        )}
      </Card>
    </div>
  );
}
