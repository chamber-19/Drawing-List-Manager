// Top project bar: project id/name on the left, key stats in the middle,
// action buttons on the right. The `view` prop ("drawings" | "reconcile" |
// "export") swaps the stat block contents — drawings shows register stats,
// reconcile shows scan stats, etc.

import { T } from "../tokens.js";

function Stat({ k, v, accent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          fontFamily: T.fMono,
          fontSize: 9,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: T.t3,
        }}
      >
        {k}
      </div>
      <div
        style={{
          fontFamily: T.fMono,
          fontSize: 13,
          color: accent ? T.acc : T.t1,
        }}
      >
        {v}
      </div>
    </div>
  );
}

function Btn({ children, disabled, onClick, primary, ghost, title }) {
  const base = {
    padding: "7px 14px",
    border: `1px solid ${T.bd}`,
    borderRadius: T.rSm,
    background: T.bgEl,
    color: T.t1,
    fontFamily: T.fMono,
    fontSize: 11,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    transition: "background .12s, color .12s",
  };
  const variant = primary
    ? { background: T.acc, color: T.tOn, border: `1px solid ${T.acc}` }
    : ghost
      ? { background: "transparent", border: `1px solid ${T.bdSoft}`, color: T.t2 }
      : {};
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      style={{ ...base, ...variant }}
    >
      {children}
    </button>
  );
}

export default function ProjectBar({
  marker,
  marker_path,
  register,
  scan,
  view,
  dirty,
  saving,
  onRescan,
  onSave,
  onPromoteToIFC,
  onClose, // eslint-disable-line no-unused-vars
}) {
  const projNumber = marker?.project_number || "—";
  const projName = marker?.project_name || "";
  const folder = marker_path
    ? marker_path.replace(/[\\/][^\\/]*$/, "")
    : "";

  const drawingCount = register?.drawings?.length || 0;
  const issuesCount = scan
    ? (scan.missing_dwg.length + scan.orphan_dwg.length + scan.stale_pdf.length)
    : 0;

  // Promote-to-IFC is only useful while at IFA. Hidden once at IFC or beyond.
  const canPromote =
    register?.current_phase === "IFA" ||
    (register?.drawings || []).some(
      (d) => (d.revisions || []).slice(-1)[0]?.phase === "IFA",
    );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 32,
        padding: "12px 24px",
        borderBottom: `1px solid ${T.bd}`,
        background: T.bgEl,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <div
          style={{
            fontFamily: T.fMono,
            fontSize: 13,
            color: T.acc,
            letterSpacing: "0.02em",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {projNumber}
          {dirty && (
            <span
              title="Unsaved changes"
              style={{
                color: T.warn,
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ●
            </span>
          )}
        </div>
        <div style={{ fontFamily: T.fDisp, fontSize: 18, color: T.t1, letterSpacing: "-0.01em" }}>
          {projName || "Untitled"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
        {view === "reconcile" ? (
          <>
            <Stat k="Register" v={drawingCount} />
            <Stat k="DWG on disk" v={scan?.dwg_files?.length ?? "—"} />
            <Stat k="PDF on disk" v={scan?.pdf_files?.length ?? "—"} />
            <Stat k="Issues" v={issuesCount} accent={issuesCount > 0} />
          </>
        ) : (
          <>
            <Stat k="Drawings" v={drawingCount} />
            <Stat k="Phase" v={register?.current_phase || "—"} />
            <Stat
              k="Folder"
              v={
                <span
                  style={{ color: T.acc, fontSize: 11 }}
                  title={folder}
                >
                  {folder.length > 36 ? "…" + folder.slice(-34) : folder || "—"}
                </span>
              }
            />
          </>
        )}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        {view === "reconcile" ? (
          <Btn ghost onClick={onRescan} title="Re-scan project folders">
            Re-scan
          </Btn>
        ) : (
          <>
            {canPromote && (
              <Btn
                ghost
                onClick={onPromoteToIFC}
                title="Add IFC Rev 0 to every drawing whose latest rev is IFA"
              >
                Promote to IFC
              </Btn>
            )}
            <Btn
              primary
              disabled={!dirty || saving}
              onClick={onSave}
              title={dirty ? "Save register and regenerate Excel" : "No unsaved changes"}
            >
              {saving ? "Saving…" : "Save"}
            </Btn>
            <Btn disabled title="Standalone export — coming next slice">
              Export
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}
