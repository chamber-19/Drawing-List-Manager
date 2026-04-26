// Modal shell — overlay + centered card with title, body, footer slots.
// Closes on Escape and on overlay click (unless `dismissOnOverlayClick`
// is false, e.g. for forms with unsaved input).

import { useEffect } from "react";
import { T } from "../../tokens.js";

export default function Modal({
  isOpen,
  title,
  onClose,
  children,
  footer,
  dismissOnOverlayClick = false,
  width = "default",
}) {
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widths = { narrow: 420, default: 560, wide: 760 };

  return (
    <div
      onClick={dismissOnOverlayClick ? onClose : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        animation: "modal-fade-in .15s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: widths[width] || widths.default,
          maxWidth: "92vw",
          maxHeight: "85vh",
          background: T.bgEl,
          border: `1px solid ${T.bd}`,
          borderRadius: T.rLg,
          boxShadow: "0 30px 60px -15px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 22px",
            borderBottom: `1px solid ${T.bdSoft}`,
            fontFamily: T.fDisp,
            fontStyle: "italic",
            fontSize: 19,
            color: T.t1,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>

        <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
          {children}
        </div>

        {footer && (
          <div
            style={{
              padding: "14px 22px",
              borderTop: `1px solid ${T.bdSoft}`,
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Common button used in modal footers — kept here so every modal has the
// same look for Cancel / primary / destructive actions.
export function ModalButton({ children, onClick, primary, danger, disabled, type = "button" }) {
  const base = {
    padding: "8px 16px",
    border: `1px solid ${T.bd}`,
    borderRadius: T.rSm,
    background: T.bgEl,
    color: T.t1,
    fontFamily: T.fMono,
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
  };
  const variant = danger
    ? { background: T.err, color: "#FFFFFF", border: `1px solid ${T.err}` }
    : primary
      ? { background: T.acc, color: T.tOn, border: `1px solid ${T.acc}` }
      : {};
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...variant }}
    >
      {children}
    </button>
  );
}
