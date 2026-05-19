mod claude_bridge;
mod commands;

pub use claude_bridge::ClaudeBridgeState;
use commands::{cancel_claude, spawn_claude};
use tauri_plugin_sql::{Migration, MigrationKind};

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "cross_edges",
            sql: include_str!("../migrations/0002_cross_edges.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "tool_name",
            sql: include_str!("../migrations/0003_tool_name.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
