mod claude_bridge;
mod commands;

pub use claude_bridge::ClaudeBridgeState;
use commands::{cancel_claude, spawn_claude};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ClaudeBridgeState::default())
        .invoke_handler(tauri::generate_handler![spawn_claude, cancel_claude])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
