// Landing view — recent projects list + Open / Create action cards.

import { useEffect, useState } from "react";
import { api } from "../api.js";
import { T } from "../tokens.js";

async function pickMarkerFile() {
  // Use the Tauri dialog plugin to let the user pick the .r3p-project.json
  // marker. In the browser dev path, fall back to a simple prompt.
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [
        { name: "R3P Project Marker", extensions: ["json"] },
      ],
    });
    return typeof selected === "string" ? selected : null;
  } catch {
    const fallback = window.prompt("Path to .r3p-project.json:");
    return fallback || null;
  }
}

function ActionCard({ title, subtitle, onClick, disabled, tooltip }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      title={tooltip}
      style={{
        flex: 1,
        padding: 24,
        background: T.bgCard,
        border: `1px solid ${T.bdSoft}`,
        borderRadius: T.r,
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontFamily: T.fDisp, fontSize: 22, color: T.t1, letterSpacing: "-0.01em" }}>
        {title}
      </div>
      <div style={{ color: T.t3, fontSize: 13 }}>{subtitle}</div>
    </button>
  );
}

export default function LandingView({ onOpen }) {
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.recent().then((r) => setRecent(r.recent || [])).catch((e) => setError(e.message));
  }, []);

  async function handleOpen() {
    const path = await pickMarkerFile();
    if (path) onOpen(path);
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "48px 64px",
        display: "flex",
        flexDirection: "column",
        gap: 32,
        maxWidth: 1100,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <div>
        <div style={{ fontFamily: T.fDisp, fontSize: 36, color: T.t1, letterSpacing: "-0.02em" }}>
          Drawing List Manager
        </div>
        <div
          style={{
            fontFamily: T.fMono,
            fontSize: 11,
            color: T.t3,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginTop: 6,
          }}
        >
          Project drawing registers · ROOT3POWER
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <ActionCard
          title="Open project"
          subtitle="Browse to an existing .r3p-project.json marker."
          onClick={handleOpen}
        />
        <ActionCard
          title="Create project"
          subtitle="Start a new project register."
          disabled
          tooltip="Coming next slice"
        />
      </div>

      <div>
        <div
          style={{
            fontFamily: T.fMono,
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.t3,
            marginBottom: 12,
          }}
        >
          Recent projects
        </div>
        {recent.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: T.t4,
              fontStyle: "italic",
              border: `1px dashed ${T.bdSoft}`,
              borderRadius: T.r,
            }}
          >
            No recent projects yet — use Open or Create above to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recent.map((r) => (
              <button
                key={r.marker_path}
                type="button"
                onClick={() => onOpen(r.marker_path)}
                className="dlm-hoverable"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "10px 14px",
                  background: T.bgEl,
                  border: `1px solid ${T.bdSoft}`,
                  borderRadius: T.rSm,
                  textAlign: "left",
                  cursor: "pointer",
                  color: T.t1,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.fMono, fontSize: 12, color: T.acc }}>
                    {r.project_number}
                  </div>
                  <div style={{ color: T.t1, marginTop: 2 }}>
                    {r.project_name || "Untitled"}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: T.fMono,
                    fontSize: 10,
                    color: T.t3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 360,
                  }}
                  title={r.marker_path}
                >
                  {r.marker_path}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: T.err, fontFamily: T.fMono, fontSize: 11 }}>
          backend unreachable: {error}
        </div>
      )}
    </div>
  );
}
