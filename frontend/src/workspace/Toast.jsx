// Minimal toast notification — bottom-right, fades out after 1.5s.
//
// Usage:
//   const { toast, show } = useToast();
//   show("Saved");
//   show("Save failed: ...", "err");
//   <Toast toast={toast} />

import { useState, useEffect } from "react";
import { T } from "../tokens.js";

export function useToast() {
  const [toast, setToast] = useState(null);
  function show(message, kind = "ok") {
    setToast({ message, kind, id: Date.now() });
  }
  return { toast, show };
}

export function Toast({ toast }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(t);
  }, [toast?.id]);
  if (!toast || !visible) return null;
  const colors = { ok: T.ok, err: T.err, info: T.info };
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 1100,
        background: T.bgEl,
        color: T.t1,
        padding: "10px 16px",
        borderRadius: T.r,
        borderLeft: `3px solid ${colors[toast.kind] || T.acc}`,
        boxShadow: "0 12px 30px -10px rgba(0,0,0,0.5)",
        fontFamily: T.fBody,
        fontSize: 13,
      }}
    >
      {toast.message}
    </div>
  );
}
