// Two-button confirmation modal — generic OK/Cancel.

import Modal, { ModalButton } from "./Modal.jsx";
import { T } from "../../tokens.js";

export default function ConfirmModal({
  isOpen,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      width="narrow"
      footer={
        <>
          <ModalButton onClick={onCancel}>{cancelLabel}</ModalButton>
          <ModalButton primary={!danger} danger={danger} onClick={onConfirm}>
            {confirmLabel}
          </ModalButton>
        </>
      }
    >
      <div style={{ color: T.t2 }}>{body}</div>
    </Modal>
  );
}
