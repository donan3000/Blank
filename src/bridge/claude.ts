import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SpawnOpts, ClaudeStreamEvent, ExitPayload } from "./events";

export async function spawnClaude(opts: SpawnOpts): Promise<string> {
  return invoke<string>("spawn_claude", { opts });
}

export async function cancelClaude(spawnId: string): Promise<void> {
  await invoke("cancel_claude", { spawnId });
}

export async function subscribeEvents(
  spawnId: string,
  onEvent: (e: ClaudeStreamEvent) => void,
  onExit?: (code: number | null) => void,
): Promise<UnlistenFn> {
  const unlistenEvent = await listen<ClaudeStreamEvent>(
    `claude://event/${spawnId}`,
    (e) => onEvent(e.payload),
  );
  const unlistenExit = await listen<ExitPayload>(
    `claude://exit/${spawnId}`,
    (e) => onExit?.(e.payload.code),
  );
  return () => {
    unlistenEvent();
    unlistenExit();
  };
}
