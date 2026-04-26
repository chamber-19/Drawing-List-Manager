// Bulk-set-status modal — pick a status and apply to N drawings.

import { useEffect, useMemo, useState } from "react";
import Modal, { ModalButton } from "./Modal.jsx";
import { T } from "../../tokens.js";

const STATUSES = [
  "NOT CREATED YET",
  "IN DESIGN",
  "READY FOR DRAFTING",
  "READY FOR SUBMITTAL",
];

export default function SetStatusModal({ isOpen, drawings, onApply, onCancel }) {
  const [status, setStatus] = useState("IN DESIGN");
  useEffect(() => {
    if (isOpen) setStatus("IN DESIGN");
  }, [isOpen]);

  const breakdown = useMemo(() => {
    const counts = new Map();
    for (const d of drawings || []) {
      counts.set(d.status, (counts.get(d.status) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([s, n]) => `${n} ${s.toLowerCase()}`)
      .join(", ");
  }, [drawings]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={`Set status of ${drawings.length} drawings`}
      footer={
        <>
          <ModalButton onClick={onCancel}>Cancel</ModalButton>
          <ModalButton primary onClick={() => onApply(status)}>
            Apply
          </ModalButton>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
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
            New status
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              width: "100%",
              background: T.bg,
              border: `1px solid ${T.bd}`,
              color: T.t1,
              padding: "7px 10px",
              borderRadius: T.rSm,
              font: "inherit",
              outline: "none",
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {breakdown && (
          <div style={{ color: T.t3, fontSize: 12 }}>
            currently: {breakdown}
          </div>
        )}
      </div>
    </Modal>
  );
}
