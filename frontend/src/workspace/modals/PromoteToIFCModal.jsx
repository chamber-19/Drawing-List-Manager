// Project-level Promote to IFC modal — every drawing whose latest rev is
// IFA gets a new IFC Rev 0 entry. Shows a preview of affected/skipped
// drawings before committing.

import { useEffect, useState } from "react";
import Modal, { ModalButton } from "./Modal.jsx";
import { T } from "../../tokens.js";
import { previewPromoteToIFC } from "../../operations.js";
import { formatCurrentRev } from "../format.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function PromoteToIFCModal({ isOpen, register, onApply, onCancel }) {
  const [date, setDate] = useState(todayISO());
  useEffect(() => {
    if (isOpen) setDate(todayISO());
  }, [isOpen]);

  const { affected, skipped } = previewPromoteToIFC(register || { drawings: [] });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Promote project to IFC"
      width="wide"
      footer={
        <>
          <ModalButton onClick={onCancel}>Cancel</ModalButton>
          <ModalButton primary onClick={() => onApply(date)} disabled={affected.length === 0}>
            Promote to IFC
          </ModalButton>
        </>
      }
    >
      <div style={{ color: T.t2, marginBottom: 14 }}>
        All drawings whose latest revision is IFA will get a new IFC Rev 0
        entry. Drawings already at IFC or beyond, drawings with no
        revisions, and superseded drawings are skipped.
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
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
            Date
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              background: T.bg,
              border: `1px solid ${T.bd}`,
              color: T.t1,
              padding: "7px 10px",
              borderRadius: T.rSm,
              outline: "none",
              font: "inherit",
            }}
          />
        </div>
        <div style={{ color: T.t3, fontFamily: T.fMono, fontSize: 11 }}>
          {affected.length} affected · {skipped.length} skipped
        </div>
      </div>

      <div
        style={{
          border: `1px solid ${T.bdSoft}`,
          borderRadius: T.rSm,
          background: T.bg,
          maxHeight: 320,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr 160px 130px",
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
          <span>Current latest</span>
          <span>New entry</span>
        </div>
        {affected.map((d) => (
          <div
            key={d.drawing_number}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr 160px 130px",
              gap: 12,
              padding: "6px 12px",
              fontFamily: T.fMono,
              fontSize: 11,
              color: T.t1,
              borderBottom: `1px solid ${T.bdSoft}`,
            }}
          >
            <span style={{ color: T.acc }}>{d.drawing_number}</span>
            <span style={{ fontFamily: T.fBody, color: T.t2 }}>{d.description}</span>
            <span>{formatCurrentRev(d)}</span>
            <span>
              <span style={{ color: T.acc }}>IFC</span> Rev 0
            </span>
          </div>
        ))}
        {skipped.map(({ d, reason }) => (
          <div
            key={d.drawing_number + ":skip"}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr 160px 130px",
              gap: 12,
              padding: "6px 12px",
              fontFamily: T.fMono,
              fontSize: 11,
              color: T.t4,
              borderBottom: `1px solid ${T.bdSoft}`,
            }}
          >
            <span>{d.drawing_number}</span>
            <span style={{ fontFamily: T.fBody }}>{d.description}</span>
            <span>{formatCurrentRev(d)}</span>
            <span style={{ fontStyle: "italic", color: T.warn }}>skipped · {reason}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
