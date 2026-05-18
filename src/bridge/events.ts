export interface SpawnOpts {
  prompt: string;
  session_id?: string;
  resume_from?: string;
  fork: boolean;
  append_system_prompt?: string;
  cwd: string;
  allowed_tools: string[];
}

export type ClaudeStreamEvent =
  | { type: "system"; subtype: string; session_id: string; raw: unknown }
  | { type: "assistant"; message: unknown; session_id: string }
  | { type: "user"; message: unknown; session_id: string }
  | { type: "stream_event"; event: unknown; session_id: string }
  | {
      type: "result";
      total_cost_usd: number;
      duration_ms: number;
      is_error: boolean;
      session_id: string;
    }
  | { type: "unknown"; raw: unknown };

export interface ExitPayload {
  code: number | null;
}

export const EventKind = [
  "system",
  "assistant",
  "user",
  "stream_event",
  "result",
  "unknown",
] as const;

export type EventKindT = (typeof EventKind)[number];

export function parseEvent(value: unknown): ClaudeStreamEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as { type?: unknown };
  if (typeof v.type !== "string") return null;
  if (!(EventKind as readonly string[]).includes(v.type)) return null;
  return value as ClaudeStreamEvent;
}
