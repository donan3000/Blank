mod claude_bridge;
mod commands;

pub use claude_bridge::ClaudeBridgeState;
use commands::{cancel_claude, spawn_claude};
use tauri_plugin_sql::{Migration, MigrationKind};

pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "init",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:canvas.db", migrations)
                .build(),
        )
        .manage(ClaudeBridgeState::default())
        .invoke_handler(tauri::generate_handler![spawn_claude, cancel_claude])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
