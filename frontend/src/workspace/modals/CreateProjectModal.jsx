// Create-project modal — pick a folder, give a project number + name,
// hits POST /api/project/create.

import { useEffect, useState } from "react";
import Modal, { ModalButton } from "./Modal.jsx";
import { T } from "../../tokens.js";

const PROJECT_NUMBER_RE = /^R3P-\d{4,6}$/;

async function pickFolder() {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false });
    return typeof selected === "string" ? selected : null;
  } catch {
    return window.prompt("Project folder path:");
  }
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
      {hint && (
        <span style={{ color: T.t4, textTransform: "none", letterSpacing: 0 }}>{hint}</span>
      )}
    </div>
  );
}

export default function CreateProjectModal({ isOpen, onClose, onCreate }) {
  const [projectNumber, setProjectNumber] = useState("R3P-");
  const [projectName, setProjectName] = useState("");
  const [folder, setFolder] = useState("");
  const [drawingsFolder, setDrawingsFolder] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProjectNumber("R3P-");
      setProjectName("");
      setFolder("");
      setDrawingsFolder("");
      setError(null);
      setBusy(false);
    }
  }, [isOpen]);

  async function browse() {
    const f = await pickFolder();
    if (f) setFolder(f);
  }

  async function browseDrawings() {
    const f = await pickFolder();
    if (f) setDrawingsFolder(f);
  }

  async function submit(e) {
    e?.preventDefault?.();
    setError(null);
    if (!projectName.trim()) {
      setError("Project name is required.");
      return;
    }
    if (!PROJECT_NUMBER_RE.test(projectNumber.trim())) {
      setError("Project number must look like R3P-25074.");
      return;
    }
    if (!folder.trim()) {
      setError("Pick a folder for the project.");
      return;
    }
    setBusy(true);
    try {
      await onCreate({
        folder: folder.trim(),
        project_number: projectNumber.trim(),
        project_name: projectName.trim(),
        drawings_root: drawingsFolder.trim(),
      });
    } catch (err) {
      setError(err?.message || String(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title="Create project"
      footer={
        <>
          <ModalButton onClick={onClose} disabled={busy}>
            Cancel
          </ModalButton>
          <ModalButton primary onClick={submit} disabled={busy || !projectName.trim()}>
            {busy ? "Creating…" : "Create project"}
          </ModalButton>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <Label hint="e.g. R3P-25074">Project number</Label>
          <input
            value={projectNumber}
            onChange={(e) => setProjectNumber(e.target.value)}
            spellCheck={false}
            style={{ ...fieldStyle(), fontFamily: T.fMono, color: T.acc }}
          />
        </div>
        <div>
          <Label>Project name</Label>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g. North Substation Upgrade"
            style={fieldStyle()}
          />
        </div>
        <div>
          <Label>Folder</Label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="Click Browse or paste a path"
              style={{ ...fieldStyle(), fontFamily: T.fMono, fontSize: 12 }}
            />
            <button
              type="button"
              onClick={browse}
              style={{
                background: T.bgEl,
                border: `1px solid ${T.bd}`,
                color: T.t1,
                padding: "7px 14px",
                borderRadius: T.rSm,
                cursor: "pointer",
                fontFamily: T.fMono,
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Browse…
            </button>
          </div>
        </div>
        <div>
          <Label hint="optional — browse to an existing drawings folder to auto-populate">
            Drawings folder
          </Label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={drawingsFolder}
              onChange={(e) => setDrawingsFolder(e.target.value)}
              placeholder="Leave blank to set up later"
              style={{ ...fieldStyle(), fontFamily: T.fMono, fontSize: 12, color: T.t2 }}
            />
            <button
              type="button"
              onClick={browseDrawings}
              style={{
                background: T.bgEl,
                border: `1px solid ${T.bd}`,
                color: T.t1,
                padding: "7px 14px",
                borderRadius: T.rSm,
                cursor: "pointer",
                fontFamily: T.fMono,
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Browse…
            </button>
          </div>
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
