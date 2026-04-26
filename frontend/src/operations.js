// Pure-function register mutations. Each function takes the current
// register and operation params, returns a NEW register dict (immutable
// update — input is never mutated).
//
// Invariants:
// - Input register is never mutated (deep clone on entry)
// - Output register has _parsed stripped from drawings (transient field)
// - Validation is NOT done here — callers run validate_register on the
//   result. Operations that can produce an obviously invalid register
//   (e.g. add drawing with duplicate number) still emit it; the validator
//   catches it on save.

function clone(reg) {
  return JSON.parse(JSON.stringify(reg));
}

function stripParsed(reg) {
  for (const d of reg.drawings || []) delete d._parsed;
  return reg;
}

export function addDrawing(register, drawing) {
  const reg = stripParsed(clone(register));
  reg.drawings = reg.drawings || [];
  reg.drawings.push({
    drawing_number: drawing.drawing_number,
    description: drawing.description,
    set: drawing.set,
    status: drawing.status || "NOT CREATED YET",
    notes: drawing.notes ?? null,
    superseded: false,
    revisions: [],
  });
  return reg;
}

export function updateDrawing(register, drawingNumber, fields) {
  const reg = stripParsed(clone(register));
  const d = (reg.drawings || []).find((x) => x.drawing_number === drawingNumber);
  if (!d) return reg;
  if ("description" in fields) d.description = fields.description;
  if ("notes" in fields) d.notes = fields.notes;
  if ("status" in fields) d.status = fields.status;
  if ("set" in fields) d.set = fields.set;
  return reg;
}

/**
 * Suggest the next rev label for a drawing under a given target phase.
 * - Target IFA, current latest is IFA letter → next letter
 * - Target IFA, no revisions → "A"
 * - Target IFC/IFR/etc, current latest is IFC numeric → next number
 * - Target IFC, current latest is IFA → "0" (transition)
 * - Target IFC, no revisions → "0"
 */
export function suggestNextRev(drawing, targetPhase) {
  const revs = drawing.revisions || [];
  const last = revs[revs.length - 1];

  if (targetPhase === "IFA") {
    if (!last || last.phase !== "IFA") return "A";
    return advanceLetter(last.rev);
  }

  // For IFC / IFR / IFB / IFF / IFRef:
  if (!last) return "0";
  if (last.phase === "IFA") {
    // Transition from IFA to numeric — start at "0".
    return "0";
  }
  // Already in a numeric series: increment.
  const n = parseInt(last.rev, 10);
  return Number.isNaN(n) ? "0" : String(n + 1);
}

function advanceLetter(letter) {
  // "A" → "B", "Z" → "AA", "AZ" → "BA", "ZZ" → "AAA"
  const chars = letter.split("");
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i] !== "Z") {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join("");
    }
    chars[i] = "A";
  }
  return "A".repeat(chars.length + 1);
}

export function advanceRev(register, drawingNumbers, params) {
  // params: { phase, percent, date }
  const reg = stripParsed(clone(register));
  const targets = new Set(drawingNumbers);
  for (const d of reg.drawings || []) {
    if (!targets.has(d.drawing_number)) continue;
    if (d.superseded) continue;
    const rev = suggestNextRev(d, params.phase);
    d.revisions = d.revisions || [];
    d.revisions.push({
      rev,
      date: params.date,
      phase: params.phase,
      percent: params.phase === "IFA" ? (params.percent ?? null) : null,
    });
  }
  return reg;
}

export function setStatus(register, drawingNumbers, status) {
  const reg = stripParsed(clone(register));
  const targets = new Set(drawingNumbers);
  for (const d of reg.drawings || []) {
    if (targets.has(d.drawing_number)) d.status = status;
  }
  return reg;
}

export function markSuperseded(register, drawingNumbers) {
  const reg = stripParsed(clone(register));
  const targets = new Set(drawingNumbers);
  for (const d of reg.drawings || []) {
    if (targets.has(d.drawing_number)) d.superseded = true;
  }
  return reg;
}

export function promoteToIFC(register, date) {
  // Every drawing whose latest rev is IFA gets a new IFC Rev 0.
  // Drawings already at IFC or beyond, drawings with no revisions, and
  // superseded drawings are skipped.
  const reg = stripParsed(clone(register));
  for (const d of reg.drawings || []) {
    if (d.superseded) continue;
    const revs = d.revisions || [];
    const last = revs[revs.length - 1];
    if (!last) continue;
    if (last.phase !== "IFA") continue;
    revs.push({ rev: "0", date, phase: "IFC", percent: null });
    d.revisions = revs;
  }
  reg.current_phase = "IFC";
  return reg;
}

// Helper for previews: count drawings that promoteToIFC would touch.
export function previewPromoteToIFC(register) {
  const affected = [];
  const skipped = [];
  for (const d of register.drawings || []) {
    if (d.superseded) {
      skipped.push({ d, reason: "superseded" });
      continue;
    }
    const revs = d.revisions || [];
    const last = revs[revs.length - 1];
    if (!last) {
      skipped.push({ d, reason: "no revisions" });
      continue;
    }
    if (last.phase !== "IFA") {
      skipped.push({ d, reason: `already ${last.phase}` });
      continue;
    }
    affected.push(d);
  }
  return { affected, skipped };
}
