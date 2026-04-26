// Three-button confirmation shown when the user tries to navigate away
// from a project with unsaved changes.

import Modal, { ModalButton } from "./Modal.jsx";
import { T } from "../../tokens.js";

export default function ConfirmUnsavedModal({
  isOpen,
  onSaveFirst,
  onDiscard,
  onCancel,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Unsaved changes"
      width="narrow"
      footer={
        <>
          <ModalButton onClick={onCancel}>Cancel</ModalButton>
          <ModalButton danger onClick={onDiscard}>
            Discard changes
          </ModalButton>
          <ModalButton primary onClick={onSaveFirst}>
            Save first
          </ModalButton>
        </>
      }
    >
      <div style={{ color: T.t2 }}>
        You have unsaved changes in this project. What would you like to do?
      </div>
    </Modal>
  );
}
