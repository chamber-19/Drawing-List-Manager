// NavTree — left pane of the workspace.
//
// Computes the type-band hierarchy from `register.drawings`. Uses the
// `_parsed` field that the backend precomputes on /api/project/open so we
// don't need a parallel JS catalogue of the standards data.

import { useMemo, useState } from "react";
import { T } from "../tokens.js";
import { Chevron, StatusGlyph } from "./glyphs.jsx";

function NavSectionHeader({ children }) {
  return (
    <div
      style={{
        fontFamily: T.fMono,
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: T.t3,
        padding: "14px 14px 6px",
      }}
    >
      {children}
    </div>
  );
}

function Row({ children, active, dim, onClick, indent = 0, title }) {
  return (
    <div
      onClick={onClick}
      title={title}
      className={onClick ? "dlm-hoverable" : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "16px 1fr auto",
        alignItems: "center",
        gap: 6,
        padding: "5px 14px",
        paddingLeft: 14 + indent,
        cursor: onClick ? "pointer" : "default",
        opacity: dim ? 0.45 : 1,
        background: active ? T.accGlow : "transparent",
        borderLeft: `2px solid ${active ? T.acc : "transparent"}`,
        color: active ? T.t1 : T.t2,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

export default function NavTree({
  register,
  selectedBand,
  selectedStatus,
  selectedSet,
  onSelectBand,
  onSelectStatus,
  onSelectSet,
}) {
  // Group drawings by type then by band. Drawings without a band entry
  // are bucketed under a synthetic "_unbanded" key so we still surface
  // them in the tree.
  const tree = useMemo(() => {
    const byType = new Map();
    for (const d of register?.drawings || []) {
      const p = d._parsed;
      const typeKey = p ? `${p.discipline}${p.type_digit}` : "??";
      if (!byType.has(typeKey)) {
        byType.set(typeKey, {
          typeKey,
          discipline: p?.discipline || "",
          typeDigit: p?.type_digit || "",
          bands: new Map(),
          count: 0,
        });
      }
      const t = byType.get(typeKey);
      t.count += 1;
      const bandKey = p?.band ? `${p.band.start}-${p.band.end}` : "_unbanded";
      const bandLabel = p?.band?.label || "Unbanded";
      if (!t.bands.has(bandKey)) {
        t.bands.set(bandKey, {
          key: bandKey,
          start: p?.band?.start ?? null,
          end: p?.band?.end ?? null,
          label: bandLabel,
          count: 0,
        });
      }
      t.bands.get(bandKey).count += 1;
    }
    return [...byType.values()].sort((a, b) => a.typeKey.localeCompare(b.typeKey));
  }, [register]);

  const statusCounts = useMemo(() => {
    const c = {
      "READY FOR SUBMITTAL": 0,
      "READY FOR DRAFTING": 0,
      "IN DESIGN": 0,
      "NOT CREATED YET": 0,
    };
    for (const d of register?.drawings || []) {
      if (d.status in c) c[d.status] += 1;
    }
    return c;
  }, [register]);

  const setCounts = useMemo(() => {
    const c = { "P&C": 0, Physicals: 0 };
    for (const d of register?.drawings || []) {
      if (d.set in c) c[d.set] += 1;
    }
    return c;
  }, [register]);

  // Track which type rows are expanded. Default: any type with the
  // currently-selected band, plus types with > 0 drawings.
  const [open, setOpen] = useState(() => {
    const init = {};
    for (const t of tree) init[t.typeKey] = true;
    return init;
  });

  function toggleType(k) {
    setOpen((p) => ({ ...p, [k]: !p[k] }));
  }

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        borderRight: `1px solid ${T.bd}`,
        background: T.bg,
        overflowY: "auto",
        paddingBottom: 24,
      }}
    >
      <NavSectionHeader>Browse</NavSectionHeader>
      <Row
        active={selectedBand === null && !selectedStatus && !selectedSet}
        onClick={() => {
          onSelectBand(null);
          onSelectStatus(null);
          onSelectSet(null);
        }}
      >
        <span />
        <span>All drawings</span>
        <span style={{ fontFamily: T.fMono, fontSize: 11, color: T.t3 }}>
          {register?.drawings?.length || 0}
        </span>
      </Row>

      <NavSectionHeader>Types</NavSectionHeader>
      {tree.map((t) => {
        const isOpen = !!open[t.typeKey];
        return (
          <div key={t.typeKey}>
            <Row onClick={() => toggleType(t.typeKey)}>
              <Chevron open={isOpen} />
              <span>
                <span
                  style={{
                    fontFamily: T.fMono,
                    fontSize: 10,
                    color: T.acc,
                    background: T.accGlow,
                    padding: "1px 5px",
                    borderRadius: 3,
                    marginRight: 8,
                  }}
                >
                  {t.typeKey}
                </span>
                <span style={{ color: T.t1 }}>Type {t.typeDigit}</span>
              </span>
              <span style={{ fontFamily: T.fMono, fontSize: 11, color: T.t3 }}>
                {t.count}
              </span>
            </Row>
            {isOpen &&
              [...t.bands.values()].map((b) => {
                const isActive =
                  selectedBand &&
                  selectedBand.typeKey === t.typeKey &&
                  selectedBand.bandKey === b.key;
                return (
                  <Row
                    key={b.key}
                    indent={20}
                    active={isActive}
                    onClick={() =>
                      onSelectBand(
                        isActive
                          ? null
                          : {
                              typeKey: t.typeKey,
                              discipline: t.discipline,
                              typeDigit: t.typeDigit,
                              bandKey: b.key,
                              start: b.start,
                              end: b.end,
                              label: b.label,
                            },
                      )
                    }
                  >
                    <span />
                    <span style={{ color: isActive ? T.t1 : T.t2 }}>
                      {b.label}
                      {b.start != null && (
                        <span
                          style={{
                            color: isActive ? T.acc : T.t4,
                            fontFamily: T.fMono,
                            fontSize: 10,
                            marginLeft: 6,
                          }}
                        >
                          {String(b.start).padStart(4, "0")}-
                          {String(b.end).padStart(4, "0")}
                        </span>
                      )}
                    </span>
                    <span style={{ fontFamily: T.fMono, fontSize: 11, color: T.t3 }}>
                      {b.count}
                    </span>
                  </Row>
                );
              })}
          </div>
        );
      })}

      <NavSectionHeader>Filter by status</NavSectionHeader>
      {Object.entries(statusCounts).map(([status, count]) => (
        <Row
          key={status}
          active={selectedStatus === status}
          onClick={() =>
            onSelectStatus(selectedStatus === status ? null : status)
          }
        >
          <StatusGlyph status={status} />
          <span style={{ textTransform: "lowercase" }}>{status.toLowerCase()}</span>
          <span style={{ fontFamily: T.fMono, fontSize: 11, color: T.t3 }}>
            {count}
          </span>
        </Row>
      ))}

      <NavSectionHeader>Sets</NavSectionHeader>
      {Object.entries(setCounts).map(([s, count]) => (
        <Row
          key={s}
          active={selectedSet === s}
          onClick={() => onSelectSet(selectedSet === s ? null : s)}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: s === "P&C" ? T.acc : T.info,
              marginLeft: 4,
            }}
          />
          <span>{s}</span>
          <span style={{ fontFamily: T.fMono, fontSize: 11, color: T.t3 }}>
            {count}
          </span>
        </Row>
      ))}
    </div>
  );
}
