use std::fs::File;
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{Manager, RunEvent, State};

static BACKEND_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Connection details the frontend needs to talk to the private backend instance.
#[derive(Serialize, Clone)]
struct BackendConfig {
    port: u16,
    token: String,
}

#[tauri::command]
fn backend_config(config: State<BackendConfig>) -> BackendConfig {
    config.inner().clone()
}

/// 256-bit session token from the operating system's CSPRNG.
fn random_token() -> String {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).expect("OS random number generator unavailable");
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn free_port() -> Option<u16> {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .ok()
}

fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(&addr, Duration::from_millis(250)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    false
}

/// Bundled PyInstaller backend (onedir). Tauri copies it into the app's resource directory.
fn bundled_backend(resource_dir: &Path) -> Option<PathBuf> {
    let name = if cfg!(windows) { "backend-service.exe" } else { "backend-service" };
    let candidate = resource_dir.join("backend-service").join(name);
    candidate.exists().then_some(candidate)
}

/// Development fallback: project virtualenv, then whatever Python is on PATH.
fn dev_python(root: &Path) -> PathBuf {
    if let Ok(custom) = std::env::var("MARKITDOWN_PYTHON") {
        return PathBuf::from(custom);
    }
    let venv = if cfg!(windows) {
        root.join(".venv").join("Scripts").join("python.exe")
    } else {
        root.join(".venv").join("bin").join("python3")
    };
    if venv.exists() {
        venv
    } else if cfg!(windows) {
        PathBuf::from("python")
    } else {
        PathBuf::from("python3")
    }
}

fn spawn_backend(
    config: &BackendConfig,
    resource_dir: Option<PathBuf>,
    log_dir: Option<PathBuf>,
    data_dir: Option<PathBuf>,
) -> Result<Child, String> {
    // CARGO_MANIFEST_DIR is src-tauri/ at compile time; its parent is the project root (dev builds).
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));

    let mut cmd = if let Some(sidecar) = resource_dir.as_deref().and_then(bundled_backend) {
        log::info!("Starting bundled backend sidecar: {:?}", sidecar);
        Command::new(sidecar)
    } else {
        let api = root.join("backend").join("api.py");
        if !api.exists() {
            return Err(format!(
                "Weder ein gebündeltes Backend noch {:?} gefunden.",
                api
            ));
        }
        let python = dev_python(&root);
        log::info!("Starting development backend: {:?} {:?}", python, api);
        let mut c = Command::new(python);
        c.arg(api).current_dir(&root);
        c
    };

    cmd.env("PYTHONUNBUFFERED", "1")
        .env("MARKITDOWN_PORT", config.port.to_string())
        .env("MARKITDOWN_API_TOKEN", &config.token)
        .env("MARKITDOWN_PARENT_PID", std::process::id().to_string())
        .stdin(Stdio::null());

    // History and settings live in the OS app-data folder (Application Support / AppData).
    if let Some(dir) = data_dir {
        cmd.env("MARKITDOWN_DATA_DIR", dir);
    }

    // Keep the backend's output in a log file: a GUI app has no console, and this is the
    // first place to look when the backend does not come up.
    match log_dir.and_then(|dir| open_backend_log(&dir)) {
        Some(file) => {
            if let Ok(clone) = file.try_clone() {
                cmd.stderr(Stdio::from(clone));
            }
            cmd.stdout(Stdio::from(file));
        }
        None => {
            cmd.stdout(Stdio::null()).stderr(Stdio::null());
        }
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn()
        .map_err(|e| format!("Backend konnte nicht gestartet werden: {e}"))
}

fn open_backend_log(dir: &Path) -> Option<File> {
    std::fs::create_dir_all(dir).ok()?;
    File::create(dir.join("backend.log")).ok()
}

/// Writes panics to a file: release builds on Windows have no console to show them.
fn install_panic_log() {
    std::panic::set_hook(Box::new(|info| {
        let path = std::env::temp_dir().join("markitdown-desktop-crash.log");
        let _ = std::fs::write(path, format!("{info}\n"));
    }));
}

fn stop_backend() {
    if let Ok(mut lock) = BACKEND_PROCESS.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_panic_log();
    let config = BackendConfig {
        port: free_port().unwrap_or(8765),
        token: random_token(),
    };

    let app = tauri::Builder::default()
        // Opens external links in the default browser; allowed URLs are scoped in capabilities/default.json.
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(config.clone())
        .invoke_handler(tauri::generate_handler![backend_config])
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let cfg = app.state::<BackendConfig>().inner().clone();
            let resource_dir = app.path().resource_dir().ok();
            let log_dir = app.path().app_log_dir().ok();
            let data_dir = app.path().app_data_dir().ok();

            // Start the backend off the main thread so the window appears immediately.
            std::thread::spawn(move || match spawn_backend(&cfg, resource_dir, log_dir, data_dir) {
                Ok(child) => {
                    if let Ok(mut lock) = BACKEND_PROCESS.lock() {
                        *lock = Some(child);
                    }
                    if wait_for_port(cfg.port, Duration::from_secs(90)) {
                        log::info!("Backend is listening on 127.0.0.1:{}", cfg.port);
                    } else {
                        log::error!("Backend did not open port {} in time", cfg.port);
                    }
                }
                Err(e) => log::error!("{}", e),
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_handle, event| {
        if let RunEvent::Exit = event {
            stop_backend();
        }
    });
}
