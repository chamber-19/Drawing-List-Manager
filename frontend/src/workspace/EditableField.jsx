// EditableField — text or textarea that toggles into edit mode on click.
// Props:
//   value:       current value
//   onCommit:    (newValue) => void
//   placeholder: shown when value is empty
//   multiline:   boolean — render as textarea instead of input
//   readOnly:    boolean — render as plain text, no edit affordance

import { useState, useRef, useEffect } from "react";
import { T } from "../tokens.js";

export default function EditableField({
  value,
  onCommit,
  placeholder,
  multiline,
  readOnly,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      // Select all so the user can quickly retype.
      try {
        ref.current.select?.();
      } catch {
        /* ignore */
      }
    }
  }, [editing]);

  if (readOnly) {
    return (
      <span style={{ color: value ? T.t1 : T.t4, fontStyle: value ? "normal" : "italic" }}>
        {value || placeholder}
      </span>
    );
  }

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        title="Click to edit"
        style={{
          cursor: "text",
          color: value ? T.t1 : T.t4,
          fontStyle: value ? "normal" : "italic",
          padding: "2px 4px",
          margin: "-2px -4px",
          borderRadius: 3,
          transition: "background .12s",
          display: "inline-block",
          minWidth: 24,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = T.bgCard)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {value || placeholder}
      </span>
    );
  }

  function commit() {
    if ((draft ?? "") !== (value ?? "")) onCommit(draft);
    setEditing(false);
  }
  function cancel() {
    setDraft(value ?? "");
    setEditing(false);
  }

  const commonStyle = {
    width: "100%",
    background: T.bg,
    border: `1px solid ${T.acc}`,
    color: T.t1,
    font: "inherit",
    padding: "4px 6px",
    borderRadius: 3,
    outline: "none",
  };

  if (multiline) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        rows={3}
        style={{ ...commonStyle, resize: "vertical" }}
      />
    );
  }

  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      style={commonStyle}
    />
  );
}
