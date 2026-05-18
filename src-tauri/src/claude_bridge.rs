use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "snake_case")]
pub struct SpawnOpts {
    pub prompt: String,
    pub session_id: Option<String>,
    pub resume_from: Option<String>,
    pub fork: bool,
    pub append_system_prompt: Option<String>,
    pub cwd: String,
    pub allowed_tools: Vec<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClaudeStreamEvent {
    System {
        subtype: String,
        session_id: String,
        raw: serde_json::Value,
    },
    Assistant {
        message: serde_json::Value,
        session_id: String,
    },
    User {
        message: serde_json::Value,
        session_id: String,
    },
    StreamEvent {
        event: serde_json::Value,
        session_id: String,
    },
    Result {
        total_cost_usd: f64,
        duration_ms: u64,
        is_error: bool,
        session_id: String,
    },
    Unknown {
        raw: serde_json::Value,
    },
}

#[derive(Default)]
pub struct ClaudeBridgeState {
    pub children: Arc<DashMap<String, CommandChild>>,
}

pub fn parse_line(line: &str) -> ClaudeStreamEvent {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return ClaudeStreamEvent::Unknown {
            raw: serde_json::json!({ "_parse_error": "empty line", "_raw": line }),
        };
    }

    let value: serde_json::Value = match serde_json::from_str(trimmed) {
        Ok(v) => v,
        Err(e) => {
            return ClaudeStreamEvent::Unknown {
                raw: serde_json::json!({
                    "_parse_error": format!("invalid json: {e}"),
                    "_raw": line,
                }),
            };
        }
    };

    let ty = value.get("type").and_then(|v| v.as_str()).unwrap_or("");
    let session_id = value
        .get("session_id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    match ty {
        "system" => {
            let subtype = value
                .get("subtype")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            ClaudeStreamEvent::System {
                subtype,
                session_id,
                raw: value,
            }
        }
        "assistant" => ClaudeStreamEvent::Assistant {
            message: value.get("message").cloned().unwrap_or(serde_json::Value::Null),
            session_id,
        },
        "user" => ClaudeStreamEvent::User {
            message: value.get("message").cloned().unwrap_or(serde_json::Value::Null),
            session_id,
        },
        "stream_event" => ClaudeStreamEvent::StreamEvent {
            event: value.get("event").cloned().unwrap_or(serde_json::Value::Null),
            session_id,
        },
        "result" => ClaudeStreamEvent::Result {
            total_cost_usd: value
                .get("total_cost_usd")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0),
            duration_ms: value
                .get("duration_ms")
                .and_then(|v| v.as_u64())
                .unwrap_or(0),
            is_error: value
                .get("is_error")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            session_id,
        },
        _ => ClaudeStreamEvent::Unknown { raw: value },
    }
}

fn build_args(opts: &SpawnOpts) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    args.push("-p".into());
    args.push(opts.prompt.clone());
    args.push("--output-format".into());
    args.push("stream-json".into());
    args.push("--verbose".into());

    if !opts.allowed_tools.is_empty() {
        args.push("--allowed-tools".into());
        args.push(opts.allowed_tools.join(","));
    }

    if let Some(sid) = &opts.session_id {
        args.push("--session-id".into());
        args.push(sid.clone());
    }

    if let Some(resume) = &opts.resume_from {
        args.push("--resume".into());
        args.push(resume.clone());
    }

    // --fork-session only does anything alongside --resume; we leave that policy to callers.
    if opts.fork {
        args.push("--fork-session".into());
    }

    if let Some(sys) = &opts.append_system_prompt {
        args.push("--append-system-prompt".into());
        args.push(sys.clone());
    }

    args
}

pub async fn spawn(
    app: AppHandle,
    state: &ClaudeBridgeState,
    opts: SpawnOpts,
) -> anyhow::Result<String> {
    let args = build_args(&opts);

    let (mut rx, child) = app
        .shell()
        .command("claude")
        .args(args)
        .current_dir(&opts.cwd)
        .spawn()
        .map_err(|e| anyhow::anyhow!("failed to spawn claude: {e}"))?;

    let spawn_id = uuid::Uuid::new_v4().to_string();
    state.children.insert(spawn_id.clone(), child);

    let children = state.children.clone();
    let app_handle = app.clone();
    let spawn_id_task = spawn_id.clone();

    tokio::spawn(async move {
        // Claude streams newline-delimited JSON across stdout; a single CommandEvent::Stdout
        // chunk may contain partial lines or multiple lines, so buffer until we see '\n'.
        let mut buf: Vec<u8> = Vec::new();
        let event_topic = format!("claude://event/{spawn_id_task}");
        let exit_topic = format!("claude://exit/{spawn_id_task}");

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    buf.extend_from_slice(&bytes);
                    while let Some(nl) = buf.iter().position(|b| *b == b'\n') {
                        let line_bytes: Vec<u8> = buf.drain(..=nl).collect();
                        let line = String::from_utf8_lossy(&line_bytes[..line_bytes.len() - 1]);
                        let parsed = parse_line(&line);
                        if let Err(e) = app_handle.emit(&event_topic, parsed) {
                            eprintln!("[claude_bridge] emit failed: {e}");
                        }
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let s = String::from_utf8_lossy(&bytes);
                    eprintln!("[claude stderr {spawn_id_task}] {s}");
                }
                CommandEvent::Terminated(payload) => {
                    if !buf.is_empty() {
                        let line = String::from_utf8_lossy(&buf);
                        let parsed = parse_line(&line);
                        let _ = app_handle.emit(&event_topic, parsed);
                        buf.clear();
                    }
                    children.remove(&spawn_id_task);
                    let _ = app_handle.emit(
                        &exit_topic,
                        serde_json::json!({ "code": payload.code }),
                    );
                    break;
                }
                CommandEvent::Error(err) => {
                    eprintln!("[claude error {spawn_id_task}] {err}");
                }
                _ => {}
            }
        }
    });

    Ok(spawn_id)
}

pub fn cancel(state: &ClaudeBridgeState, spawn_id: &str) -> anyhow::Result<()> {
    if let Some((_, child)) = state.children.remove(spawn_id) {
        child
            .kill()
            .map_err(|e| anyhow::anyhow!("failed to kill child {spawn_id}: {e}"))?;
    }
    Ok(())
}
