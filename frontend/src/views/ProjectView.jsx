// Workspace shell. Owns the per-project view state (active tab, nav
// selection, work-pane selection) and renders the three-zone layout:
//
//   ProjectBar
//   ViewTabs
//   ┌─────────────┬─────────────────────────┐
//   │  NavTree    │  WorkPane (band cards)  │
//   ├─────────────┴─────────────────────────┤
//   │  Inspector (selection > 0)            │
//   └────────────────────────────────────────┘

import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useSelection } from "../selection.js";
import { T } from "../tokens.js";
import ProjectBar from "../workspace/ProjectBar.jsx";
import ViewTabs from "../workspace/ViewTabs.jsx";
import NavTree from "../workspace/NavTree.jsx";
import BandCard from "../workspace/BandCard.jsx";
import Inspector from "../workspace/Inspector.jsx";
import ReconcileView from "../workspace/ReconcileView.jsx";
import { bandKeyFor } from "../workspace/bandKey.js";

export default function ProjectView({ markerPath, onClose }) {
  const [marker, setMarker] = useState(null);
  const [register, setRegister] = useState(null);
  const [scan, setScan] = useState(null);
  const [activeView, setActiveView] = useState("drawings");
  const [selectedBand, setSelectedBand] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [error, setError] = useState(null);
  const sel = useSelection();

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
      const title = `${marker.project_number} — ${marker.project_name || "Drawing List Manager"}`;
      document.title = title;
    }
    return () => {
      document.title = "Drawing List Manager";
    };
  }, [marker]);

  // Filter drawings down based on nav selection.
  const visibleDrawings = useMemo(() => {
    let list = register?.drawings || [];
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
            start: d._parsed?.band?.start ?? null,
            end: d._parsed?.band?.end ?? null,
            label: d._parsed?.band?.label || `Type ${d._parsed?.type_digit || "?"} (unbanded)`,
          },
          drawings: [],
        });
      }
      groups.get(id).drawings.push(d);
    }
    // Sort drawings inside each band by sequence number.
    for (const g of groups.values()) {
      g.drawings.sort((a, b) => (a._parsed?.seq || 0) - (b._parsed?.seq || 0));
    }
    return [...groups.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <ProjectBar
        marker={marker}
        marker_path={markerPath}
        register={register}
        scan={scan}
        view={activeView}
        onRescan={handleRescan}
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
    </div>
  );
}
