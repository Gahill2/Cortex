#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;

#[derive(Debug, Clone, Copy)]
struct HostConfig {
    overlay_mode_enabled: bool,
    idle_lock_signaling_enabled: bool,
}

impl HostConfig {
    fn from_env() -> Self {
        Self {
            overlay_mode_enabled: env_flag("CORTEX_DESKTOP_OVERLAY"),
            idle_lock_signaling_enabled: env_flag("CORTEX_IDLE_LOCK_SIGNALING"),
        }
    }
}

#[derive(Default, Debug)]
struct HostState {
    overlay_active: bool,
    idle_lock_active: bool,
}

#[tauri::command]
fn set_overlay_mode(
    app: tauri::AppHandle,
    enabled: bool,
    reason: Option<String>,
) -> Result<(), String> {
    let config = app.state::<HostConfig>();
    if !config.overlay_mode_enabled {
        return Err(
            "overlay mode hook is disabled (set CORTEX_DESKTOP_OVERLAY=1 to enable)".to_string(),
        );
    }

    let state = app.state::<Mutex<HostState>>();
    let mut state = state
        .lock()
        .map_err(|_| "failed to lock host state for overlay update".to_string())?;
    state.overlay_active = enabled;

    println!(
        "[cortex-desktop] overlay hook: enabled={enabled}, reason={}",
        reason.unwrap_or_else(|| "none".to_string())
    );
    Ok(())
}

#[tauri::command]
fn signal_idle_lock(
    app: tauri::AppHandle,
    locked: bool,
    source: Option<String>,
) -> Result<(), String> {
    let config = app.state::<HostConfig>();
    if !config.idle_lock_signaling_enabled {
        return Err(
            "idle lock hook is disabled (set CORTEX_IDLE_LOCK_SIGNALING=1 to enable)".to_string(),
        );
    }

    let state = app.state::<Mutex<HostState>>();
    let mut state = state
        .lock()
        .map_err(|_| "failed to lock host state for idle lock update".to_string())?;
    state.idle_lock_active = locked;

    println!(
        "[cortex-desktop] idle lock hook: locked={locked}, source={}",
        source.unwrap_or_else(|| "unknown".to_string())
    );
    Ok(())
}

fn apply_safe_window_behavior(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("[cortex-desktop] main window not found during setup");
        return;
    };

    if let Err(err) = window.show() {
        eprintln!("[cortex-desktop] failed to show window: {err}");
    }
    if let Err(err) = window.set_focus() {
        eprintln!("[cortex-desktop] failed to focus window: {err}");
    }
    if let Err(err) = window.maximize() {
        eprintln!("[cortex-desktop] failed to maximize window: {err}");
    }
}

fn env_flag(name: &str) -> bool {
    std::env::var(name)
        .ok()
        .map(|value| {
            let value = value.trim();
            value == "1" || value.eq_ignore_ascii_case("true") || value.eq_ignore_ascii_case("yes")
        })
        .unwrap_or(false)
}

fn main() {
    println!("[cortex-desktop] booting shell host");
    let host_config = HostConfig::from_env();
    println!(
        "[cortex-desktop] hooks: overlay={}, idle_lock_signaling={}",
        host_config.overlay_mode_enabled, host_config.idle_lock_signaling_enabled
    );

    tauri::Builder::default()
        .manage(host_config)
        .manage(Mutex::new(HostState::default()))
        .invoke_handler(tauri::generate_handler![set_overlay_mode, signal_idle_lock])
        .setup(|app| {
            println!("[cortex-desktop] setup start");
            apply_safe_window_behavior(app);
            println!("[cortex-desktop] setup complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|err| {
            eprintln!("[cortex-desktop] fatal runtime error: {err}");
        });
}
