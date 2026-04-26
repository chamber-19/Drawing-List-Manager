// Confirmation modal for marking one or more drawings as superseded.
// Used both in single-drawing inspector and bulk inspector.

import Modal, { ModalButton } from "./Modal.jsx";
import { T } from "../../tokens.js";

export default function MarkSupersededModal({
  isOpen,
  drawings,
  onConfirm,
  onCancel,
}) {
  const n = drawings.length;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={n === 1 ? "Mark drawing as superseded?" : `Mark ${n} drawings as superseded?`}
      footer={
        <>
          <ModalButton onClick={onCancel}>Cancel</ModalButton>
          <ModalButton danger onClick={onConfirm}>
            Mark superseded
          </ModalButton>
        </>
      }
    >
      <div style={{ color: T.t2, marginBottom: 14 }}>
        Superseded drawings are hidden from the active view but kept in the
        register for the audit trail. <strong style={{ color: T.warn }}>This cannot be undone in this version.</strong>
      </div>
      <div
        style={{
          maxHeight: 220,
          overflowY: "auto",
          background: T.bg,
          border: `1px solid ${T.bdSoft}`,
          borderRadius: T.rSm,
          padding: "8px 12px",
        }}
      >
        {drawings.map((d) => (
          <div
            key={d.drawing_number}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: 12,
              padding: "4px 0",
              fontFamily: T.fMono,
              fontSize: 11,
            }}
          >
            <span style={{ color: T.acc }}>{d.drawing_number}</span>
            <span style={{ color: T.t2, fontFamily: T.fBody }}>{d.description}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
