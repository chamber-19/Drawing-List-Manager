// Drawing List Manager — Tauri desktop shell
//
// Startup sequence:
//   1. Splash window opens with visible:false; React invokes `splash_ready`
//      after the first CSS paint so the user never sees a transparent ghost.
//   2. Background thread runs the setup sequence while emitting
//      `splash://status` events that drive the splash terminal animation:
//        a. Spawn the PyInstaller sidecar (or Python dev-server fallback).
//        b. Emit "Mounting shared drive" → Ok  (informational only).
//        c. Emit "Checking for updates" → Ok  (deferred to React on mount).
//   3. The thread waits until at least MIN_SPLASH_MS have elapsed so the
//      full animation plays before the transition.
//   4. The splash closes and the main window opens. The React app then
//      invokes `check_for_update` on mount and shows the UpdateModal if
//      a newer version is found on the shared drive.

mod sidecar;

use desktop_toolkit::{splash, updater};
use desktop_toolkit::updater::UpdateState;

use std::process::Child;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{Emitter, Manager};

// ── Backend state ─────────────────────────────────────────────────────────

/// Holds the backend base URL; updated once the sidecar starts.
struct BackendState {
    url: Mutex<String>,
}

/// Tauri command: return the backend base URL to the webview.
#[tauri::command]
fn get_backend_url(state: tauri::State<BackendState>) -> String {
    state.url.lock().unwrap().clone()
}

const BACKEND_ADDR: &str = "127.0.0.1:8001";

// ── DLM constants ─────────────────────────────────────────────────────────

/// Directory on the shared drive that contains `latest.json` and the installer.
/// Stub: the real path will be wired when DLM ships its first installer.
const DLM_UPDATE_PATH_DEFAULT: &str =
    r"G:\Shared drives\R3P RESOURCES\APPS\Drawing List Manager";

/// Sub-directory of `%LOCALAPPDATA%` used for the updater log.
const DLM_LOG_DIR: &str = "Drawing List Manager";

/// App data directory name used for the splash-seen sentinel.
const DLM_APP_IDENTIFIER: &str = "Drawing List Manager";

/// PyInstaller sidecar binary name (without `.exe`).
const DLM_SIDECAR_NAME: &str = "dlm-backend";

// ── Splash timing ─────────────────────────────────────────────────────────

/// Minimum splash display for first run / post-update (ms).
const MIN_SPLASH_MS: u64 = 13_000;

/// Minimum splash display for subsequent launches (ms).
const MIN_SPLASH_MS_SHORT: u64 = 3_200;

/// How long the splash holds the "ready" state before starting the fade (ms).
const FADE_HOLD_MS: u64 = 800;

/// Duration of the splash fade-out animation (ms).
const FADE_DURATION_MS: u64 = 1000;

/// Extra safety margin after the fade completes before the Rust fallback fires (ms).
const FADE_SAFETY_MS: u64 = 400;

// ── Tauri commands: update check / start ──────────────────────────────────

/// Returned by the `check_for_update` Tauri command.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CheckUpdateResult {
    update_available: bool,
    version: Option<String>,
    notes: Option<String>,
}

/// Check whether a newer version is available on the shared drive.
///
/// All failures degrade silently — returns `{ updateAvailable: false }` so
/// the user can still use the app when the drive is unreachable.
#[tauri::command]
fn check_for_update(state: tauri::State<UpdateState>) -> CheckUpdateResult {
    match updater::check_for_update(env!("CARGO_PKG_VERSION"), DLM_LOG_DIR) {
        updater::UpdateCheckResult::UpdateAvailable { latest, update_path } => {
            *state.latest.lock().unwrap() = Some(latest.clone());
            *state.update_path.lock().unwrap() = Some(update_path);
            CheckUpdateResult {
                update_available: true,
                version: Some(latest.version),
                notes: latest.notes,
            }
        }
        _ => CheckUpdateResult {
            update_available: false,
            version: None,
            notes: None,
        },
    }
}

/// Delegate the update orchestration to the `desktop-toolkit-updater.exe` shim.
#[tauri::command]
fn start_update(
    app: tauri::AppHandle,
    state: tauri::State<UpdateState>,
) -> Result<(), String> {
    updater::start_update(app, state, DLM_SIDECAR_NAME, DLM_LOG_DIR)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let child: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let child_for_setup = child.clone();

    // Set the default shared-drive update path for the framework's updater module.
    // SAFETY: single-threaded at this point — tauri::Builder hasn't spawned any
    // threads yet. `std::env::set_var` is unsafe in Rust 1.81+ in multi-threaded
    // programs; this call is safe here because it precedes thread creation.
    if std::env::var(updater::UPDATE_PATH_ENV_VAR).is_err() {
        #[allow(unsafe_code)]
        // SAFETY: single-threaded at this point — see above.
        unsafe {
            std::env::set_var(updater::UPDATE_PATH_ENV_VAR, DLM_UPDATE_PATH_DEFAULT);
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_backend_url,
            check_for_update,
            start_update,
            splash::splash_is_first_run,
            splash::splash_ready,
            splash::splash_fade_complete,
        ])
        .manage(BackendState {
            url: Mutex::new(format!("http://{BACKEND_ADDR}")),
        })
        .manage(UpdateState::new())
        .manage(splash::SplashState::new(splash::first_launch_after_update(
            DLM_APP_IDENTIFIER,
            env!("CARGO_PKG_VERSION"),
        )))
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let child_arc = child_for_setup.clone();

            // Run the startup sequence in a background thread so the splash
            // window remains responsive (event loop keeps running).
            thread::spawn(move || {
                startup_sequence(app_handle, child_arc);
            });

            Ok(())
        })
        .on_window_event({
            let child_cleanup = child.clone();
            move |_window, event| {
                if let tauri::WindowEvent::Destroyed = event {
                    let mut proc_opt = child_cleanup.lock().unwrap().take();
                    if let Some(ref mut proc) = proc_opt {
                        println!("[tauri] Stopping backend sidecar (PID {})", proc.id());
                        let _ = proc.kill();
                        let _ = proc.wait();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ── Startup sequence ──────────────────────────────────────────────────────

fn startup_sequence(app: tauri::AppHandle, child_arc: Arc<Mutex<Option<Child>>>) {
    let start = Instant::now();

    // Brief pause to let the splash window finish its initial render.
    thread::sleep(Duration::from_millis(200));

    // ── 1. Backend ────────────────────────────────────────────────────────
    splash::emit_status(
        &app,
        "backend",
        "Starting backend service",
        splash::StatusKind::Pending,
    );
    let backend_url = do_spawn_backend(&child_arc);
    println!("[tauri] Backend URL: {backend_url}");
    splash::emit_status(&app, "backend", "Starting backend service", splash::StatusKind::Ok);

    // Store backend URL in managed state.
    if let Some(state) = app.try_state::<BackendState>() {
        *state.url.lock().unwrap() = backend_url;
    }

    // ── 2. Shared drive (informational; actual check deferred to React) ───
    splash::emit_status(&app, "mount", "Mounting shared drive", splash::StatusKind::Pending);
    splash::emit_status(&app, "mount", "Mounting shared drive", splash::StatusKind::Ok);

    // ── 3. Update check status (deferred; emit Ok immediately) ───────────
    splash::emit_status(&app, "updates", "Checking for updates", splash::StatusKind::Pending);
    splash::emit_status(&app, "updates", "Checking for updates", splash::StatusKind::Ok);

    // ── 4. Final status ────────────────────────────────────────────────────
    splash::emit_status(&app, "final", "Ready", splash::StatusKind::Ok);
    thread::sleep(Duration::from_millis(200));

    // ── 5. Minimum display duration ────────────────────────────────────────
    let is_first = app
        .try_state::<splash::SplashState>()
        .map(|s| s.first_run())
        .unwrap_or(true);
    let min_ms = if is_first { MIN_SPLASH_MS } else { MIN_SPLASH_MS_SHORT };
    let elapsed = start.elapsed().as_millis() as u64;
    if elapsed < min_ms {
        thread::sleep(Duration::from_millis(min_ms - elapsed));
    }

    // ── 6. Transition to main window ──────────────────────────────────────
    if let Err(e) = app.emit("splash://fade-now", ()) {
        eprintln!("[splash] emit splash://fade-now failed: {e}");
    }

    thread::sleep(Duration::from_millis(
        FADE_HOLD_MS + FADE_DURATION_MS + FADE_SAFETY_MS,
    ));

    // Safety net: idempotent if the frontend already invoked
    // splash_fade_complete from `transitionend`.
    let app_for_ui = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(main_win) = app_for_ui.get_webview_window("main") {
            let _ = main_win.show();
        }
        splash::close_splash(&app_for_ui);
    });
}

// ── Backend spawning ──────────────────────────────────────────────────────

fn do_spawn_backend(child_arc: &Arc<Mutex<Option<Child>>>) -> String {
    // Production: try the PyInstaller sidecar first.
    if let Some(sidecar_path) = sidecar::find_sidecar_path() {
        println!("[sidecar] Found sidecar at: {}", sidecar_path.display());
        match sidecar::spawn_sidecar(&sidecar_path) {
            Ok((proc, port)) => {
                *child_arc.lock().unwrap() = Some(proc);
                return format!("http://127.0.0.1:{port}");
            }
            Err(e) => {
                eprintln!("[sidecar] {e} -- falling back to Python dev server");
            }
        }
    }

    // Dev fallback: Python uvicorn on the fixed port 8001.
    sidecar::spawn_python_dev_backend(child_arc);
    format!("http://{BACKEND_ADDR}")
}
