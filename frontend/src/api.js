// Backend API client — thin fetch wrappers, one function per endpoint.
// Base URL is provided by the Tauri shell via the `get_backend_url`
// command. In a plain browser dev server (vite without tauri), we fall
// back to the well-known port the backend runs on.

let _baseUrl = null;

async function baseUrl() {
  if (_baseUrl !== null) return _baseUrl;
  try {
    // Lazy-load so this module works in non-Tauri (browser) contexts too.
    const { invoke } = await import("@tauri-apps/api/core");
    _baseUrl = await invoke("get_backend_url");
  } catch {
    _baseUrl = "http://127.0.0.1:8001";
  }
  return _baseUrl;
}

async function get(path) {
  const r = await fetch(`${await baseUrl()}${path}`);
  if (!r.ok) throw new Error(`GET ${path} failed: ${r.status}`);
  return r.json();
}

async function post(path, body) {
  const r = await fetch(`${await baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    // Try to surface the structured error detail from the backend.
    let detail = null;
    try {
      detail = await r.json();
    } catch {
      /* ignore non-JSON error bodies */
    }
    const err = new Error(
      `POST ${path} failed: ${r.status}${detail?.detail?.message ? ` — ${detail.detail.message}` : ""}`,
    );
    err.status = r.status;
    err.detail = detail?.detail ?? detail;
    throw err;
  }
  return r.json();
}

export const api = {
  health: () => get("/api/health"),
  recent: () => get("/api/project/recent"),
  openProject: (markerPath) =>
    post("/api/project/open", { marker_path: markerPath }),
  scanProject: (markerPath) =>
    post("/api/project/scan", { marker_path: markerPath }),
  validateRegister: (markerPath) =>
    get(`/api/register/validate?marker_path=${encodeURIComponent(markerPath)}`),
  saveRegister: (markerPath, register) =>
    post("/api/register/save", { marker_path: markerPath, register }),
  createProject: (folder, projectNumber, projectName = "", paths = {}) =>
    post("/api/project/create", {
      folder,
      project_number: projectNumber,
      project_name: projectName,
      paths,
    }),
};
