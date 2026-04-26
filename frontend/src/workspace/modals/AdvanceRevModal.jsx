// Bulk-advance-rev modal — pick a phase + (optional) percent + date,
// preview the next-rev for each selected drawing, then apply.

import { useEffect, useMemo, useState } from "react";
import Modal, { ModalButton } from "./Modal.jsx";
import { T } from "../../tokens.js";
import { suggestNextRev } from "../../operations.js";
import { formatCurrentRev } from "../format.js";

const PHASES = ["IFA", "IFC", "IFR", "IFB", "IFF", "IFRef"];
const STD_PERCENTS = [30, 60, 90];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fieldStyle() {
  return {
    background: T.bg,
    border: `1px solid ${T.bd}`,
    color: T.t1,
    padding: "7px 10px",
    borderRadius: T.rSm,
    font: "inherit",
    outline: "none",
    width: "100%",
  };
}

function Label({ children }) {
  return (
    <div
      style={{
        fontFamily: T.fMono,
        fontSize: 9,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: T.t3,
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

export default function AdvanceRevModal({
  isOpen,
  drawings,
  defaultPhase,
  onApply,
  onCancel,
}) {
  const [phase, setPhase] = useState(defaultPhase || "IFA");
  const [percent, setPercent] = useState(60);
  const [customPercent, setCustomPercent] = useState("");
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    if (!isOpen) return;
    setPhase(defaultPhase || "IFA");
    setDate(todayISO());
  // Suggest a sensible default percent based on the most recent IFA
    // percent across the selection: pick the next standard step up.
    const lastPercents = (drawings || [])
      .map((d) => (d.revisions || []).slice(-1)[0])
      .filter((r) => r && r.phase === "IFA" && r.percent != null)
      .map((r) => r.percent);
    let next = 30;
    if (lastPercents.length) {
      const mx = Math.max(...lastPercents);
      next = STD_PERCENTS.find((p) => p > mx) ?? 90;
    }
    setPercent(next);
    setCustomPercent("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultPhase]);

  const effectivePercent = useMemo(() => {
    if (phase !== "IFA") return null;
    if (percent === "custom") {
      const n = parseInt(customPercent, 10);
      return Number.isNaN(n) ? null : n;
    }
    return percent;
  }, [phase, percent, customPercent]);

  const previews = useMemo(
    () =>
      (drawings || []).map((d) => ({
        d,
        current: formatCurrentRev(d),
        nextRev: suggestNextRev(d, phase),
        superseded: !!d.superseded,
      })),
    [drawings, phase],
  );

  const eligible = previews.filter((p) => !p.superseded);

  function apply() {
    onApply({
      phase,
      percent: effectivePercent,
      date,
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={`Advance ${eligible.length} drawing${eligible.length === 1 ? "" : "s"} to next rev`}
      width="wide"
      footer={
        <>
          <ModalButton onClick={onCancel}>Cancel</ModalButton>
          <ModalButton primary onClick={apply} disabled={eligible.length === 0}>
            Apply to {eligible.length} drawing{eligible.length === 1 ? "" : "s"}
          </ModalButton>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div>
          <Label>Phase</Label>
          <select value={phase} onChange={(e) => setPhase(e.target.value)} style={fieldStyle()}>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Percent {phase !== "IFA" && "(IFA only)"}</Label>
          <select
            value={percent}
            onChange={(e) =>
              setPercent(e.target.value === "custom" ? "custom" : Number(e.target.value))
            }
            disabled={phase !== "IFA"}
            style={fieldStyle()}
          >
            {STD_PERCENTS.map((p) => (
              <option key={p} value={p}>
                {p}%
              </option>
            ))}
            <option value="custom">custom…</option>
          </select>
          {phase === "IFA" && percent === "custom" && (
            <input
              type="number"
              value={customPercent}
              onChange={(e) => setCustomPercent(e.target.value)}
              placeholder="e.g. 45"
              style={{ ...fieldStyle(), marginTop: 6 }}
            />
          )}
        </div>
        <div>
          <Label>Date</Label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={fieldStyle()}
          />
        </div>
      </div>

      <div
        style={{
          border: `1px solid ${T.bdSoft}`,
          borderRadius: T.rSm,
          background: T.bg,
          maxHeight: 280,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr 160px 160px",
            gap: 12,
            padding: "8px 12px",
            borderBottom: `1px solid ${T.bdSoft}`,
            fontFamily: T.fMono,
            fontSize: 9,
            color: T.t3,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            background: T.bgEl,
          }}
        >
          <span>Drawing</span>
          <span>Description</span>
          <span>Current rev</span>
          <span>Will add</span>
        </div>
        {previews.map((p) => (
          <div
            key={p.d.drawing_number}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr 160px 160px",
              gap: 12,
              padding: "6px 12px",
              fontFamily: T.fMono,
              fontSize: 11,
              color: p.superseded ? T.t4 : T.t1,
              borderBottom: `1px solid ${T.bdSoft}`,
            }}
          >
            <span style={{ color: p.superseded ? T.t4 : T.acc }}>
              {p.d.drawing_number}
            </span>
            <span style={{ fontFamily: T.fBody, color: p.superseded ? T.t4 : T.t2 }}>
              {p.d.description}
            </span>
            <span>{p.current}</span>
            <span>
              {p.superseded ? (
                <em style={{ color: T.warn }}>skipped (superseded)</em>
              ) : (
                <>
                  {phase === "IFA" && effectivePercent != null && `${effectivePercent}% `}
                  <span style={{ color: T.acc }}>{phase}</span> Rev {p.nextRev}
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
