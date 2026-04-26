// Modal for adding a new drawing within a specific band.
// Pre-fills the next free seq, lets the user pick from a list of free
// seqs, and validates the assembled drawing number locally before
// committing.

import { useEffect, useMemo, useState } from "react";
import Modal, { ModalButton } from "./Modal.jsx";
import { T } from "../../tokens.js";

const STATUSES = [
  "NOT CREATED YET",
  "IN DESIGN",
  "READY FOR DRAFTING",
  "READY FOR SUBMITTAL",
];
const SETS = ["P&C", "Physicals"];

const DRAWING_NUMBER_RE = /^R3P-\d+-[A-Z]\d-\d{4}$/;

function pad4(n) {
  return String(n).padStart(4, "0");
}

function freeSeqs(band, drawings, max = 12) {
  if (!band || band.start == null) return [];
  const used = new Set(
    drawings
      .map((d) => d._parsed?.seq)
      .filter((s) => typeof s === "number"),
  );
  const result = [];
  for (let i = band.start; i <= band.end && result.length < max; i++) {
    if (!used.has(i)) result.push(i);
  }
  return result;
}

function fieldStyle() {
  return {
    width: "100%",
    background: T.bg,
    border: `1px solid ${T.bd}`,
    color: T.t1,
    padding: "7px 10px",
    borderRadius: T.rSm,
    font: "inherit",
    outline: "none",
  };
}

function Label({ children, hint }) {
  return (
    <div
      style={{
        fontFamily: T.fMono,
        fontSize: 9,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: T.t3,
        marginBottom: 4,
        display: "flex",
        gap: 8,
      }}
    >
      <span>{children}</span>
      {hint && <span style={{ color: T.t4, textTransform: "none", letterSpacing: 0 }}>{hint}</span>}
    </div>
  );
}

export default function AddDrawingModal({
  isOpen,
  onClose,
  onAdd,
  projectNumber,
  band,
  bandDrawings,
  allDrawings,
}) {
  // Discipline and type digit from the band context.
  const discipline = band?.discipline || bandDrawings?.[0]?._parsed?.discipline || "";
  const typeDigit = band?.typeDigit || bandDrawings?.[0]?._parsed?.type_digit || "";

  const free = useMemo(
    () => freeSeqs(band, bandDrawings || []),
    [band, bandDrawings],
  );
  const initialSeq = free[0] != null ? pad4(free[0]) : "";

  // The full editable drawing number string. Default to the band's
  // first free seq, fully formatted.
  const initialDn = projectNumber && discipline && typeDigit && initialSeq
    ? `${projectNumber}-${discipline}${typeDigit}-${initialSeq}`
    : "";

  const [drawingNumber, setDrawingNumber] = useState(initialDn);
  const [description, setDescription] = useState("");
  const [setTag, setSetTag] = useState(
    bandDrawings?.[0]?.set || (typeDigit === "6" ? "P&C" : "Physicals"),
  );
  const [status, setStatus] = useState("NOT CREATED YET");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);

  // Re-init form whenever the modal is (re)opened so each open starts fresh.
  useEffect(() => {
    if (isOpen) {
      setDrawingNumber(initialDn);
      setDescription("");
      setNotes("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function pickSeq(seq) {
    setDrawingNumber(`${projectNumber}-${discipline}${typeDigit}-${pad4(seq)}`);
  }

  function submit(e) {
    e?.preventDefault?.();
    const dn = drawingNumber.trim();
    if (!DRAWING_NUMBER_RE.test(dn)) {
      setError("Drawing number must look like R3P-25074-E1-0307.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if ((allDrawings || []).some((d) => d.drawing_number === dn)) {
      setError(`A drawing with number ${dn} already exists in this register.`);
      return;
    }
    // Check seq lands in the band, if a band is supplied.
    if (band && band.start != null) {
      const seq = parseInt(dn.slice(-4), 10);
      if (seq < band.start || seq > band.end) {
        setError(
          `Sequence ${pad4(seq)} is outside band ${pad4(band.start)}-${pad4(band.end)}.`,
        );
        return;
      }
    }
    onAdd({
      drawing_number: dn,
      description: description.trim(),
      set: setTag,
      status,
      notes: notes.trim() || null,
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={band?.label ? `Add drawing in ${band.label}` : "Add drawing"}
      footer={
        <>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton primary onClick={submit}>
            Add drawing
          </ModalButton>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <Label hint={band?.start != null ? `band ${pad4(band.start)}-${pad4(band.end)}` : undefined}>
            Drawing number
          </Label>
          <input
            value={drawingNumber}
            onChange={(e) => setDrawingNumber(e.target.value)}
            spellCheck={false}
            style={{ ...fieldStyle(), fontFamily: T.fMono, fontSize: 13, color: T.acc }}
          />
          {free.length > 0 && (
            <div
              style={{
                marginTop: 6,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                fontFamily: T.fMono,
                fontSize: 10,
                color: T.t3,
              }}
            >
              <span style={{ color: T.t4 }}>free seqs:</span>
              {free.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => pickSeq(s)}
                  style={{
                    padding: "2px 6px",
                    border: `1px dashed ${T.bdSoft}`,
                    background: "transparent",
                    color: T.t2,
                    borderRadius: 3,
                    cursor: "pointer",
                    fontFamily: T.fMono,
                    fontSize: 10,
                  }}
                >
                  {pad4(s)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label>Description</Label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. SUBSTATION FOUNDATION PLAN"
            style={fieldStyle()}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <Label>Set</Label>
            <select
              value={setTag}
              onChange={(e) => setSetTag(e.target.value)}
              style={fieldStyle()}
            >
              {SETS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={fieldStyle()}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>Notes (optional)</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ ...fieldStyle(), resize: "vertical" }}
          />
        </div>

        {error && (
          <div
            style={{
              color: T.err,
              fontFamily: T.fMono,
              fontSize: 11,
              padding: "8px 10px",
              border: `1px solid ${T.err}`,
              borderRadius: T.rSm,
              background: "rgba(184,92,92,0.06)",
            }}
          >
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
