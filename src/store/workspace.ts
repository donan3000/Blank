import { create } from "zustand";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { cancelClaude, spawnClaude, subscribeEvents } from "../bridge/claude";
import type { ClaudeStreamEvent } from "../bridge/events";

export type NodeKind = "user" | "assistant" | "tool_result";

export interface CanvasNode {
  id: string;
  kind: NodeKind;
  position: { x: number; y: number };
  text: string;
  toolUses?: { id: string; name: string; input: unknown }[];
  sessionId?: string;
  raw?: unknown;
}

interface State {
  trunkSessionId: string | null;
  nodes: CanvasNode[];
  events: ClaudeStreamEvent[];
  busy: boolean;
  error: string | null;
  cwd: string;
  unlisten: UnlistenFn | null;
  spawnId: string | null;

  submit: (prompt: string) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
}

export const NODE_WIDTH = 560;
const VERTICAL_GAP = 32;
const HEIGHT_GUESS: Record<NodeKind, number> = {
  user: 96,
  assistant: 220,
  tool_result: 140,
};

function nextY(nodes: CanvasNode[]): number {
  if (nodes.length === 0) return 0;
  const last = nodes[nodes.length - 1];
  return last.position.y + HEIGHT_GUESS[last.kind] + VERTICAL_GAP;
}

interface MessageBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
}

function blocksOf(message: unknown): MessageBlock[] {
  if (!message || typeof message !== "object") return [];
  const m = message as { content?: unknown };
  if (!Array.isArray(m.content)) return [];
  return m.content as MessageBlock[];
}

function extractAssistant(message: unknown): {
  text: string;
  toolUses: { id: string; name: string; input: unknown }[];
} {
  const text: string[] = [];
  const toolUses: { id: string; name: string; input: unknown }[] = [];
  for (const b of blocksOf(message)) {
    if (b.type === "text" && typeof b.text === "string") text.push(b.text);
    else if (b.type === "tool_use" && b.id && b.name) {
      toolUses.push({ id: b.id, name: b.name, input: b.input });
    }
  }
  return { text: text.join("\n\n"), toolUses };
}

function extractToolResult(message: unknown): string {
  const parts: string[] = [];
  for (const b of blocksOf(message)) {
    if (b.type !== "tool_result") continue;
    if (typeof b.content === "string") parts.push(b.content);
    else if (Array.isArray(b.content)) {
      for (const c of b.content as MessageBlock[]) {
        if (c.type === "text" && typeof c.text === "string") parts.push(c.text);
      }
    }
  }
  return parts.join("\n");
}

let nodeCounter = 0;
const nodeId = (kind: NodeKind) =>
  `${kind}-${Date.now().toString(36)}-${(nodeCounter++).toString(36)}`;

export const useWorkspace = create<State>((set, get) => ({
  trunkSessionId: null,
  nodes: [],
  events: [],
  busy: false,
  error: null,
  cwd: "/tmp",
  unlisten: null,
  spawnId: null,

  submit: async (prompt: string) => {
    const { trunkSessionId, cwd, unlisten } = get();
    if (unlisten) {
      unlisten();
      set({ unlisten: null });
    }
    set({ busy: true, error: null });

    const userNode: CanvasNode = {
      id: nodeId("user"),
      kind: "user",
      position: { x: 0, y: nextY(get().nodes) },
      text: prompt,
    };
    set({ nodes: [...get().nodes, userNode] });

    try {
      const spawnId = await spawnClaude({
        prompt,
        fork: false,
        cwd,
        allowed_tools: ["Read", "Bash", "Edit", "Write"],
        resume_from: trunkSessionId ?? undefined,
      });

      const newUnlisten = await subscribeEvents(
        spawnId,
        (e) => {
          set((s) => ({ events: [...s.events, e] }));

          if (e.type === "system" && e.subtype === "init") {
            if (!get().trunkSessionId) set({ trunkSessionId: e.session_id });
            return;
          }

          if (e.type === "assistant") {
            const { text, toolUses } = extractAssistant(e.message);
            if (!text && toolUses.length === 0) return;
            const node: CanvasNode = {
              id: nodeId("assistant"),
              kind: "assistant",
              position: { x: 0, y: nextY(get().nodes) },
              text,
              toolUses,
              sessionId: e.session_id,
              raw: e.message,
            };
            set({ nodes: [...get().nodes, node] });
            return;
          }

          if (e.type === "user") {
            const text = extractToolResult(e.message);
            if (!text) return;
            const node: CanvasNode = {
              id: nodeId("tool_result"),
              kind: "tool_result",
              position: { x: 0, y: nextY(get().nodes) },
              text,
              raw: e.message,
            };
            set({ nodes: [...get().nodes, node] });
            return;
          }

          if (e.type === "result") {
            set({ busy: false });
          }
        },
        () => set({ busy: false, spawnId: null }),
      );

      set({ unlisten: newUnlisten, spawnId });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        busy: false,
      });
    }
  },

  cancel: async () => {
    const { spawnId, unlisten } = get();
    if (spawnId) await cancelClaude(spawnId).catch(() => {});
    if (unlisten) unlisten();
    set({ unlisten: null, spawnId: null, busy: false });
  },

  reset: () => {
    const { unlisten } = get();
    if (unlisten) unlisten();
    set({
      trunkSessionId: null,
      nodes: [],
      events: [],
      busy: false,
      error: null,
      unlisten: null,
      spawnId: null,
    });
  },
}));
