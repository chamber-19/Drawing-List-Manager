// Tiny shared helpers used across the workspace UI.

// Render the current revision of a drawing as a compact human label,
// e.g. "60% IFA Rev B", "IFC Rev 0", or "—" when no revisions exist.
export function formatCurrentRev(drawing) {
  const r = (drawing?.revisions || []).slice(-1)[0];
  if (!r) return "—";
  if (r.phase === "IFA" && r.percent != null) {
    return `${r.percent}% IFA Rev ${r.rev}`;
  }
  return `${r.phase} Rev ${r.rev}`;
}
