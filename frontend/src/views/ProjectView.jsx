// Workspace shell. Owns the per-project view state (active tab, nav
// selection, work-pane selection, register draft) and renders the
// three-zone layout:
//
//   ProjectBar
//   ViewTabs
//   ┌─────────────┬─────────────────────────┐
//   │  NavTree    │  WorkPane (band cards)  │
//   ├─────────────┴─────────────────────────┤
//   │  Inspector (selection > 0)            │
//   └────────────────────────────────────────┘
//
// Slice 2: the register held in state is the in-memory draft. Every
// mutation goes through `applyOp`, which clones the register, runs a
// pure-function operation from operations.js, marks dirty, and (where
// useful) re-runs band parsing locally so the UI stays accurate without
// a server round-trip.

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useDirtyState } from "../dirty.js";
import { useSelection } from "../selection.js";
import { T } from "../tokens.js";
import ProjectBar from "../workspace/ProjectBar.jsx";
import ViewTabs from "../workspace/ViewTabs.jsx";
import NavTree from "../workspace/NavTree.jsx";
import BandCard from "../workspace/BandCard.jsx";
import Inspector from "../workspace/Inspector.jsx";
import ReconcileView from "../workspace/ReconcileView.jsx";
import { Toast, useToast } from "../workspace/Toast.jsx";
import { bandKeyFor } from "../workspace/bandKey.js";
import * as ops from "../operations.js";

import AddDrawingModal from "../workspace/modals/AddDrawingModal.jsx";
import AdvanceRevModal from "../workspace/modals/AdvanceRevModal.jsx";
import SetStatusModal from "../workspace/modals/SetStatusModal.jsx";
import MarkSupersededModal from "../workspace/modals/MarkSupersededModal.jsx";
import PromoteToIFCModal from "../workspace/modals/PromoteToIFCModal.jsx";
import ValidationErrorModal from "../workspace/modals/ValidationErrorModal.jsx";
import ConfirmUnsavedModal from "../workspace/modals/ConfirmUnsavedModal.jsx";

// Re-derive band/parsed metadata locally for drawings the user just
// added or modified. Mirrors backend `_enrich_drawings_with_parsed`.
const DRAW_RE = /^R3P-\d+-([A-Z])(\d)-(\d{4})$/;

function recomputeParsed(register) {
  if (!register?.drawings) return register;
  const next = { ...register, drawings: register.drawings.map((d) => ({ ...d })) };
  for (const d of next.drawings) {
    const m = DRAW_RE.exec(d.drawing_number || "");
    if (!m) {
      d._parsed = null;
      continue;
    }
    const [, discipline, typeDigit, seqStr] = m;
    const seq = parseInt(seqStr, 10);
    // Try to copy band from any existing sibling drawing in the same
    // (discipline, type) — slice 1 already enriched those. For unbanded
    // ranges we leave band null; the band card falls back to "unbanded".
    const sibling = next.drawings.find(
      (x) =>
        x !== d &&
        x._parsed?.discipline === discipline &&
        x._parsed?.type_digit === typeDigit &&
        x._parsed?.band &&
        seq >= x._parsed.band.start &&
        seq <= x._parsed.band.end,
    );
    d._parsed = {
      discipline,
      type_digit: typeDigit,
      seq,
      band: sibling?._parsed?.band ?? null,
    };
  }
  return next;
}

export default function ProjectView({ markerPath, onClose, registerCloseGate }) {
  const [marker, setMarker] = useState(null);
  const [register, setRegister] = useState(null);
  const [scan, setScan] = useState(null);
  const [activeView, setActiveView] = useState("drawings");
  const [selectedBand, setSelectedBand] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState(null);
  const sel = useSelection();
  const dirty = useDirtyState();
  const { toast, show: showToast } = useToast();

  // Modal open-state
  const [addBand, setAddBand] = useState(null); // band to add into; null = closed
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [setStatusOpen, setSetStatusOpen] = useState(false);
  const [supersedeTargets, setSupersedeTargets] = useState(null); // [drawingNumber] | null
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [unsavedAction, setUnsavedAction] = useState(null); // pending nav action

  useEffect(() => {
    let cancelled = false;
    setMarker(null);
    setRegister(null);
    setScan(null);
    setError(null);
    Promise.all([api.openProject(markerPath), api.scanProject(markerPath)])
      .then(([open, scanRes]) => {
        if (cancelled) return;
        setMarker(open.marker);
        setRegister(open.register);
        setScan(scanRes);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [markerPath]);

  // Window title sync
  useEffect(() => {
    if (marker) {
      const title = `${dirty.isDirty ? "● " : ""}${marker.project_number} — ${marker.project_name || "Drawing List Manager"}`;
      document.title = title;
    }
    return () => {
      document.title = "Drawing List Manager";
    };
  }, [marker, dirty.isDirty]);

  // Apply a pure-function operation to the register and mark dirty.
  const applyOp = useCallback(
    (mutator) => {
      setRegister((r) => {
        if (!r) return r;
        const next = recomputeParsed(mutator(r));
        return next;
      });
      dirty.markDirty();
    },
    [dirty],
  );

  // Filter drawings down based on nav selection. Hide superseded by default.
  const visibleDrawings = useMemo(() => {
    let list = (register?.drawings || []).filter((d) => !d.superseded);
    if (selectedBand) {
      list = list.filter((d) => {
        const k = bandKeyFor(d);
        return k.typeKey === selectedBand.typeKey && k.bandKey === selectedBand.bandKey;
      });
    }
    if (selectedStatus) list = list.filter((d) => d.status === selectedStatus);
    if (selectedSet) list = list.filter((d) => d.set === selectedSet);
    return list;
  }, [register, selectedBand, selectedStatus, selectedSet]);

  // Bucket visible drawings into bands for rendering.
  const bandedView = useMemo(() => {
    const groups = new Map();
    for (const d of visibleDrawings) {
      const k = bandKeyFor(d);
      const id = `${k.typeKey}::${k.bandKey}`;
      if (!groups.has(id)) {
        groups.set(id, {
          id,
          band: {
            typeKey: k.typeKey,
            discipline: d._parsed?.discipline || "",
            typeDigit: d._parsed?.type_digit || "",
            start: d._parsed?.band?.start ?? null,
            end: d._parsed?.band?.end ?? null,
            label: d._parsed?.band?.label || `Type ${d._parsed?.type_digit || "?"} (unbanded)`,
          },
          drawings: [],
        });
      }
      groups.get(id).drawings.push(d);
    }
    for (const g of groups.values()) {
      g.drawings.sort((a, b) => (a._parsed?.seq || 0) - (b._parsed?.seq || 0));
    }
    return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [visibleDrawings]);

  const orderedIds = useMemo(
    () => visibleDrawings.map((d) => d.drawing_number),
    [visibleDrawings],
  );

  const issueCount = scan
    ? scan.missing_dwg.length + scan.orphan_dwg.length + scan.stale_pdf.length
    : 0;

  function jumpToDrawing(drawingNumber) {
    const d = (register?.drawings || []).find(
      (x) => x.drawing_number === drawingNumber,
    );
    if (!d) return;
    const k = bandKeyFor(d);
    setActiveView("drawings");
    setSelectedStatus(null);
    setSelectedSet(null);
    setSelectedBand({
      typeKey: k.typeKey,
      bandKey: k.bandKey,
      discipline: d._parsed?.discipline || "",
      typeDigit: d._parsed?.type_digit || "",
      start: d._parsed?.band?.start ?? null,
      end: d._parsed?.band?.end ?? null,
      label: d._parsed?.band?.label || "Unbanded",
    });
    sel.toggle(drawingNumber);
  }

  async function handleRescan() {
    try {
      const s = await api.scanProject(markerPath);
      setScan(s);
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  // ── Save flow ───────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!register) return false;
    setSaving(true);
    try {
      // Strip _parsed before sending — backend strips too, this just
      // keeps payloads small.
      const payload = {
        ...register,
        drawings: register.drawings.map(({ _parsed, ...rest }) => rest),
      };
      await api.saveRegister(markerPath, payload);
      dirty.markClean();
      showToast("Saved", "ok");
      return true;
    } catch (e) {
      if (e.status === 400 && e.detail?.errors) {
        setValidationErrors(e.detail.errors);
      } else {
        showToast(`Save failed: ${e.message}`, "err");
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [register, markerPath, dirty, showToast]);

  // Intercept project-close when dirty.
  function handleCloseRequest(continuation) {
    const next = typeof continuation === "function" ? continuation : onClose;
    if (dirty.isDirty) {
      setUnsavedAction(() => next);
    } else {
      next();
    }
  }

  // Register the close-gate so the global header back button routes
  // through the unsaved-changes confirmation too.
  useEffect(() => {
    if (!registerCloseGate) return;
    registerCloseGate((continuation) => handleCloseRequest(continuation));
    return () => registerCloseGate(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty.isDirty]);

  async function unsavedSaveFirst() {
    const ok = await handleSave();
    if (ok && unsavedAction) {
      const a = unsavedAction;
      setUnsavedAction(null);
      a();
    }
  }
  function unsavedDiscard() {
    const a = unsavedAction;
    setUnsavedAction(null);
    dirty.markClean();
    a?.();
  }

  // ── Operation handlers ──────────────────────────────────────
  function selectedDrawings() {
    return (register?.drawings || []).filter((d) => sel.ids.has(d.drawing_number));
  }

  // Default phase for AdvanceRev: pick from selection's latest revisions.
  function selectionDefaultPhase() {
    const drawings = selectedDrawings();
    const phases = new Set(
      drawings.map((d) => (d.revisions || []).slice(-1)[0]?.phase).filter(Boolean),
    );
    if (phases.size === 1) return [...phases][0];
    return "IFA";
  }

  if (error) {
    return (
      <div style={{ padding: 32, color: T.err }}>
        <div style={{ fontFamily: T.fDisp, fontSize: 22, marginBottom: 12 }}>
          Failed to open project
        </div>
        <pre style={{ fontFamily: T.fMono, fontSize: 12, color: T.t2 }}>{error}</pre>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 16,
            padding: "8px 14px",
            background: T.bgEl,
            border: `1px solid ${T.bd}`,
            color: T.t1,
            borderRadius: T.rSm,
            cursor: "pointer",
          }}
        >
          Back
        </button>
      </div>
    );
  }

  if (!marker || !register) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: T.t3,
          fontFamily: T.fMono,
          fontSize: 12,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Loading project…
      </div>
    );
  }

  const activeBandForAdd = addBand;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <ProjectBar
        marker={marker}
        marker_path={markerPath}
        register={register}
        scan={scan}
        view={activeView}
        dirty={dirty.isDirty}
        saving={saving}
        onRescan={handleRescan}
        onSave={handleSave}
        onPromoteToIFC={() => setPromoteOpen(true)}
        onClose={handleCloseRequest}
      />
      <ViewTabs active={activeView} onChange={setActiveView} issueCount={issueCount} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {activeView === "drawings" && (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
              <NavTree
                register={register}
                selectedBand={selectedBand}
                selectedStatus={selectedStatus}
                selectedSet={selectedSet}
                onSelectBand={(b) => {
                  setSelectedBand(b);
                  sel.clear();
                }}
                onSelectStatus={(s) => {
                  setSelectedStatus(s);
                  sel.clear();
                }}
                onSelectSet={(s) => {
                  setSelectedSet(s);
                  sel.clear();
                }}
              />
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflowY: "auto",
                  padding: 20,
                  background: T.bgDeep,
                }}
              >
                {bandedView.length === 0 ? (
                  <div
                    style={{
                      color: T.t3,
                      fontStyle: "italic",
                      textAlign: "center",
                      padding: 48,
                    }}
                  >
                    No drawings match the current filters.
                  </div>
                ) : (
                  bandedView.map((g) => (
                    <BandCard
                      key={g.id}
                      band={g.band}
                      drawings={g.drawings}
                      selection={sel.ids}
                      onToggleSelect={sel.toggle}
                      orderedIds={orderedIds}
                      onAddInBand={() => setAddBand(g.band)}
                      focused={
                        selectedBand &&
                        selectedBand.typeKey === g.band.typeKey &&
                        selectedBand.start === g.band.start
                      }
                    />
                  ))
                )}
              </div>
            </div>
            <Inspector
              register={register}
              selection={sel.ids}
              scan={scan}
              onClear={sel.clear}
              onUpdateField={(dn, fields) =>
                applyOp((r) => ops.updateDrawing(r, dn, fields))
              }
              onMarkSuperseded={(dns) => setSupersedeTargets(dns)}
              onAdvanceRev={() => setAdvanceOpen(true)}
              onSetStatus={() => setSetStatusOpen(true)}
            />
          </div>
        )}
        {activeView === "reconcile" && (
          <ReconcileView scan={scan} onJump={jumpToDrawing} />
        )}
        {activeView === "export" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.t4,
              fontStyle: "italic",
            }}
          >
            Export view — coming next slice.
          </div>
        )}
      </div>

      <Toast toast={toast} />

      <AddDrawingModal
        isOpen={addBand != null}
        band={activeBandForAdd}
        bandDrawings={
          activeBandForAdd
            ? (register?.drawings || []).filter(
                (d) =>
                  d._parsed?.discipline === activeBandForAdd.discipline &&
                  d._parsed?.type_digit === activeBandForAdd.typeDigit,
              )
            : []
        }
        allDrawings={register?.drawings || []}
        projectNumber={marker?.project_number || ""}
        onClose={() => setAddBand(null)}
        onAdd={(drawing) => {
          applyOp((r) => ops.addDrawing(r, drawing));
          setAddBand(null);
          showToast(`Added ${drawing.drawing_number}`);
          // Bring the new drawing into focus.
          setTimeout(() => {
            sel.clear();
            sel.toggle(drawing.drawing_number);
          }, 0);
        }}
      />

      <AdvanceRevModal
        isOpen={advanceOpen}
        drawings={selectedDrawings()}
        defaultPhase={selectionDefaultPhase()}
        onCancel={() => setAdvanceOpen(false)}
        onApply={(params) => {
          const targets = selectedDrawings()
            .filter((d) => !d.superseded)
            .map((d) => d.drawing_number);
          applyOp((r) => ops.advanceRev(r, targets, params));
          setAdvanceOpen(false);
          showToast(
            `Advanced ${targets.length} drawing${targets.length === 1 ? "" : "s"} to ${params.phase}`,
          );
        }}
      />

      <SetStatusModal
        isOpen={setStatusOpen}
        drawings={selectedDrawings()}
        onCancel={() => setSetStatusOpen(false)}
        onApply={(status) => {
          const targets = selectedDrawings().map((d) => d.drawing_number);
          applyOp((r) => ops.setStatus(r, targets, status));
          setSetStatusOpen(false);
          showToast(`Status set on ${targets.length} drawings`);
        }}
      />

      <MarkSupersededModal
        isOpen={supersedeTargets != null}
        drawings={
          supersedeTargets
            ? (register?.drawings || []).filter((d) =>
                supersedeTargets.includes(d.drawing_number),
              )
            : []
        }
        onCancel={() => setSupersedeTargets(null)}
        onConfirm={() => {
          const targets = supersedeTargets;
          applyOp((r) => ops.markSuperseded(r, targets));
          setSupersedeTargets(null);
          sel.clear();
          showToast(`Marked ${targets.length} drawing${targets.length === 1 ? "" : "s"} superseded`);
        }}
      />

      <PromoteToIFCModal
        isOpen={promoteOpen}
        register={register}
        onCancel={() => setPromoteOpen(false)}
        onApply={(date) => {
          applyOp((r) => ops.promoteToIFC(r, date));
          setPromoteOpen(false);
          showToast("Promoted project to IFC");
        }}
      />

      <ValidationErrorModal
        isOpen={validationErrors != null}
        errors={validationErrors || []}
        onClose={() => setValidationErrors(null)}
      />

      <ConfirmUnsavedModal
        isOpen={unsavedAction != null}
        onCancel={() => setUnsavedAction(null)}
        onSaveFirst={unsavedSaveFirst}
        onDiscard={unsavedDiscard}
      />
    </div>
  );
}
