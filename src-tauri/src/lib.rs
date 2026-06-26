use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

const BACKEND_URL: &str = "http://127.0.0.1:18888";

struct BackendState {
    child: Option<std::process::Child>,
}

#[tauri::command]
async fn get_backend_status() -> Result<String, String> {
    let client = reqwest::Client::new();
    match client
        .get(format!("{}/api/health", BACKEND_URL))
        .timeout(Duration::from_secs(3))
        .send()
        .await
    {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(json) => Ok(json.to_string()),
            Err(e) => Err(format!("health check parse error: {}", e)),
        },
        Err(_) => Err("backend offline".into()),
    }
}

#[tauri::command]
fn get_backend_url() -> String {
    BACKEND_URL.to_string()
}

fn packaged_backend_work_dir(
    app_handle: &tauri::AppHandle,
    fallback: &std::path::Path,
) -> std::path::PathBuf {
    let work_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| fallback.to_path_buf());
    let _ = std::fs::create_dir_all(&work_dir);
    work_dir
}

fn find_python_backend(
    app_handle: &tauri::AppHandle,
) -> Option<(std::path::PathBuf, String, Vec<String>)> {
    // 1. Check for the bundled PyInstaller sidecar next to the executable.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let sidecar = dir.join("ai-backend.exe");
            if sidecar.exists() {
                return Some((
                    packaged_backend_work_dir(app_handle, dir),
                    sidecar.to_string_lossy().to_string(),
                    vec![],
                ));
            }

            let legacy_sidecar = dir
                .join("binaries")
                .join("ai-backend-x86_64-pc-windows-msvc.exe");
            if legacy_sidecar.exists() {
                return Some((
                    packaged_backend_work_dir(app_handle, dir),
                    legacy_sidecar.to_string_lossy().to_string(),
                    vec![],
                ));
            }
        }
    }
    // 2. Check for ai-backend dir with main.py and uv.
    if let Ok(cwd) = std::env::current_dir() {
        let main_py = cwd.join("ai-backend").join("main.py");
        if main_py.exists() {
            return Some((
                cwd.join("ai-backend"),
                "uv".to_string(),
                vec!["run".to_string(), "python".to_string(), "main.py".to_string()],
            ));
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(BackendState { child: None }))
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Some((work_dir, program, args)) = find_python_backend(&app_handle) {
                    match std::process::Command::new(&program)
                        .args(&args)
                        .current_dir(&work_dir)
                        .spawn()
                    {
                        Ok(child) => {
                            if let Ok(mut state) =
                                app_handle.state::<Mutex<BackendState>>().lock()
                            {
                                state.child = Some(child);
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to start Python backend: {}", e);
                        }
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Ok(mut state) = window.state::<Mutex<BackendState>>().lock() {
                    if let Some(mut child) = state.child.take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![get_backend_status, get_backend_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
