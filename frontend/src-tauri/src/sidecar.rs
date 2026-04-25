// frontend/src-tauri/src/sidecar.rs
//
// Manages the PyInstaller backend sidecar process.
//
// Protocol:
//   1. Rust picks a free TCP port and passes it via DLM_BACKEND_PORT.
//   2. The sidecar prints the confirmed port on its first stdout line, then
//      starts uvicorn.
//   3. Rust reads that line (with a 15-second timeout) to learn the actual
//      port and returns a base URL string to the caller.
//   4. The caller stores the port/URL in Tauri state and kills the child on
//      app exit.

use std::io::BufRead;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// CREATE_NO_WINDOW — prevents a console window from appearing on Windows.
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const DEV_BACKEND_PORT: &str = "8001";

/// Find a free TCP port on the loopback interface.
fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
        .unwrap_or(8001)
}

/// Locate the PyInstaller sidecar binary relative to the running executable.
///
/// Search order (all relative to the directory containing the app exe):
///   1. `binaries/dlm-backend/dlm-backend.exe`   ← NSIS layout
///   2. `dlm-backend/dlm-backend.exe`             ← flat layout
///   3. `dlm-backend.exe`                         ← single-file
pub fn find_sidecar_path() -> Option<PathBuf> {
    let exe_path = std::env::current_exe().ok()?;
    let exe_dir = exe_path.parent()?;

    let candidates = [
        exe_dir.join("binaries/dlm-backend/dlm-backend.exe"),
        exe_dir.join("dlm-backend/dlm-backend.exe"),
        exe_dir.join("dlm-backend.exe"),
    ];

    for p in &candidates {
        if p.is_file() {
            return Some(p.clone());
        }
    }
    None
}

/// Spawn the sidecar, wait for it to report its port, and return the child
/// handle together with the confirmed port number.
pub fn spawn_sidecar(sidecar_path: &PathBuf) -> Result<(Child, u16), String> {
    let port = find_free_port();

    let mut cmd = Command::new(sidecar_path);
    cmd.env("DLM_BACKEND_PORT", port.to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar '{}': {e}", sidecar_path.display()))?;

    // Read the confirmed port from the sidecar's first stdout line.
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Could not capture sidecar stdout".to_string())?;

    let (tx, rx) = mpsc::channel::<u16>();
    thread::spawn(move || {
        let reader = std::io::BufReader::new(stdout);
        if let Some(Ok(line)) = reader.lines().next() {
            if let Ok(p) = line.trim().parse::<u16>() {
                let _ = tx.send(p);
            }
        }
    });

    // Wait up to 15 seconds for the sidecar to report its port.
    let actual_port = rx.recv_timeout(Duration::from_secs(15)).unwrap_or(port);

    println!(
        "[sidecar] Sidecar spawned (PID {}), listening on port {actual_port}",
        child.id()
    );
    Ok((child, actual_port))
}

/// Dev fallback: spawn the Python uvicorn backend from the repository's
/// `backend/` directory.
pub fn spawn_python_dev_backend(child_arc: &Arc<Mutex<Option<Child>>>) {
    // Skip if already running.
    if std::net::TcpStream::connect_timeout(
        &format!("127.0.0.1:{DEV_BACKEND_PORT}")
            .parse()
            .expect("invalid socket address"),
        Duration::from_millis(300),
    )
    .is_ok()
    {
        println!("[sidecar] Backend already running on port {DEV_BACKEND_PORT}");
        return;
    }

    let python = match find_python() {
        Some(p) => p,
        None => {
            eprintln!(
                "[sidecar] Python not found. \
                 Start the backend manually: cd backend && python -m uvicorn app:app --port {DEV_BACKEND_PORT}"
            );
            return;
        }
    };

    let backend_dir = match find_backend_dir() {
        Some(d) => d,
        None => {
            eprintln!("[sidecar] Could not find backend/app.py. Start the backend manually.");
            return;
        }
    };

    println!("[sidecar] Starting Python backend on port {DEV_BACKEND_PORT}");

    match Command::new(&python)
        .args([
            "-m",
            "uvicorn",
            "app:app",
            "--host",
            "127.0.0.1",
            "--port",
            DEV_BACKEND_PORT,
            "--reload",
        ])
        .current_dir(&backend_dir)
        .spawn()
    {
        Ok(c) => {
            let pid = c.id();
            println!("[sidecar] Python backend spawned (PID {pid})");
            *child_arc.lock().unwrap() = Some(c);

            let check = child_arc.clone();
            thread::spawn(move || {
                thread::sleep(Duration::from_secs(2));
                if let Ok(mut guard) = check.lock() {
                    if let Some(ref mut proc) = *guard {
                        if let Ok(Some(status)) = proc.try_wait() {
                            eprintln!(
                                "[sidecar] Backend (PID {pid}) exited early: {status}. \
                                 Run: cd backend && pip install -r requirements.txt"
                            );
                        }
                    }
                }
            });
        }
        Err(e) => {
            eprintln!("[sidecar] Failed to spawn Python backend: {e}");
        }
    }
}

// ── Python discovery helpers ───────────────────────────────────────────────

/// Return a working Python executable path, preferring Miniconda.
///
/// Search order:
/// 1. `CONDA_PREFIX` — set when a conda environment is activated.
/// 2. Well-known Miniconda / Anaconda install directories under the home dir.
/// 3. `python` on PATH — final fallback.
fn find_python() -> Option<String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    // 1. Active conda environment ($CONDA_PREFIX).
    if let Ok(prefix) = std::env::var("CONDA_PREFIX") {
        let prefix = PathBuf::from(prefix);
        if cfg!(windows) {
            candidates.push(prefix.join("python.exe"));
        } else {
            candidates.push(prefix.join("bin").join("python"));
        }
    }

    // 2. Well-known Miniconda / Anaconda install directories.
    if let Some(home) = home_dir() {
        let dir_names = ["miniconda3", "Miniconda3", "anaconda3", "Anaconda3"];
        for dir in &dir_names {
            if cfg!(windows) {
                candidates.push(home.join(dir).join("python.exe"));
            } else {
                candidates.push(home.join(dir).join("bin").join("python"));
            }
        }
    }

    for path in &candidates {
        if path.is_file() {
            if Command::new(path)
                .arg("--version")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
            {
                println!("[sidecar] Found Python: {}", path.display());
                return Some(path.to_string_lossy().into_owned());
            }
        }
    }

    // 3. Fallback: `python` on PATH.
    if Command::new("python")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
    {
        println!("[sidecar] Found PATH Python");
        return Some("python".to_string());
    }

    None
}

/// Cross-platform helper to obtain the user's home directory.
fn home_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var("USERPROFILE").ok().map(PathBuf::from)
    }
    #[cfg(not(windows))]
    {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
}

/// Locate the repository's `backend/` directory containing `app.py`.
fn find_backend_dir() -> Option<PathBuf> {
    // 1. Compile-time anchor (most reliable during development).
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let anchored = manifest_dir.join("..").join("..").join("backend");
    if anchored.join("app.py").is_file() {
        if let Ok(abs) = anchored.canonicalize() {
            return Some(abs);
        }
    }

    // 2. CWD-relative fallback.
    for rel in ["../backend", "../../backend", "./backend"] {
        let p = PathBuf::from(rel);
        if p.join("app.py").is_file() {
            if let Ok(abs) = p.canonicalize() {
                return Some(abs);
            }
        }
    }

    None
}
