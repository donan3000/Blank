use tauri::{AppHandle, State};

use crate::claude_bridge::{self, ClaudeBridgeState, SpawnOpts};

#[tauri::command]
pub async fn spawn_claude(
    app: AppHandle,
    state: State<'_, ClaudeBridgeState>,
    opts: SpawnOpts,
) -> Result<String, String> {
    claude_bridge::spawn(app, state.inner(), opts)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cancel_claude(
    state: State<'_, ClaudeBridgeState>,
    spawn_id: String,
) -> Result<(), String> {
    claude_bridge::cancel(state.inner(), &spawn_id).map_err(|e| e.to_string())
}
