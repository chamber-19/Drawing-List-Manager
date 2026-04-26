// Validation-error modal — shown when /api/register/save returns 400
// with a list of errors.

import Modal, { ModalButton } from "./Modal.jsx";
import { T } from "../../tokens.js";

export default function ValidationErrorModal({ isOpen, errors, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cannot save — register is invalid"
      footer={<ModalButton onClick={onClose}>Close</ModalButton>}
    >
      <div style={{ color: T.t2, marginBottom: 12 }}>
        Fix the issues below and try again.
      </div>
      <ul
        style={{
          listStyle: "disc",
          paddingLeft: 22,
          color: T.t1,
          fontFamily: T.fMono,
          fontSize: 12,
          maxHeight: 320,
          overflowY: "auto",
        }}
      >
        {(errors || []).map((e, i) => (
          <li key={i} style={{ marginBottom: 6, color: T.err }}>
            {e}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
