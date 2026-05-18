import { create } from "zustand";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { cancelClaude, spawnClaude, subscribeEvents } from "../bridge/claude";
import type { ClaudeStreamEvent } from "../bridge/events";

export type NodeKind = "user" | "assistant" | "tool_result";
export type BranchFlavor = "trunk" | "same_agent" | "new_island";

export interface CanvasNode {
  id: string;
  kind: NodeKind;
  branchId: string;
  position: { x: number; y: number };
  text: string;
  toolUses?: { id: string; name: string; input: unknown }[];
  raw?: unknown;
}

export interface Branch {
  id: string;
  islandId: string;
  flavor: BranchFlavor;
  sessionId: string | null;
  parentNodeId: string | null;
  xOrigin: number;
  yOrigin: number;
  busy: boolean;
}

export interface Island {
  id: string;
  index: number;
  name?: string;
  persona?: string;
}

export const NODE_WIDTH = 560;
const VERTICAL_GAP = 32;
const BRANCH_X_GAP = 96;
const NEW_ISLAND_X_GAP = 192;
const HEIGHT_GUESS: Record<NodeKind, number> = {
  user: 96,
  assistant: 220,
  tool_result: 140,
};

interface State {
  islands: Island[];
  branches: Branch[];
  nodes: CanvasNode[];
  activeBranchId: string;
  events: ClaudeStreamEvent[];
  error: string | null;
  cwd: string;
  unlistens: Map<string, UnlistenFn>;
  spawns: Map<string, string>;

  submit: (prompt: string) => Promise<void>;
  branchSameAgent: (fromNodeId: string) => void;
  branchNewIsland: (fromNodeId: string, persona?: string) => void;
  setActiveBranch: (id: string) => void;
  cancelActive: () => Promise<void>;
  reset: () => void;
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

let idSeed = 0;
const mkId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(idSeed++).toString(36)}`;

function branchTailY(branch: Branch, nodes: CanvasNode[]): number {
  const branchNodes = nodes.filter((n) => n.branchId === branch.id);
  if (branchNodes.length === 0) return branch.yOrigin;
  const last = branchNodes[branchNodes.length - 1];
  return last.position.y + HEIGHT_GUESS[last.kind] + VERTICAL_GAP;
}

function findNode(nodes: CanvasNode[], id: string): CanvasNode | undefined {
  return nodes.find((n) => n.id === id);
}

function rightmostX(branches: Branch[]): number {
  return branches.reduce((max, b) => Math.max(max, b.xOrigin), 0);
}

const TRUNK_ISLAND_ID = "island-0";
const TRUNK_BRANCH_ID = "branch-trunk";

function initialState(): Pick<
  State,
  "islands" | "branches" | "nodes" | "activeBranchId" | "events" | "error"
> {
  return {
    islands: [{ id: TRUNK_ISLAND_ID, index: 0, name: "Trunk" }],
    branches: [
      {
        id: TRUNK_BRANCH_ID,
        islandId: TRUNK_ISLAND_ID,
        flavor: "trunk",
        sessionId: null,
        parentNodeId: null,
        xOrigin: 0,
        yOrigin: 0,
        busy: false,
      },
    ],
    nodes: [],
    activeBranchId: TRUNK_BRANCH_ID,
    events: [],
    error: null,
  };
}

export const useWorkspace = create<State>((set, get) => ({
  ...initialState(),
  cwd: "/tmp",
  unlistens: new Map(),
  spawns: new Map(),

  submit: async (prompt: string) => {
    const { activeBranchId, branches, cwd, unlistens } = get();
    const branch = branches.find((b) => b.id === activeBranchId);
    if (!branch) return;

    const existing = unlistens.get(branch.id);
    if (existing) {
      existing();
      unlistens.delete(branch.id);
    }

    set({ error: null });
    set((s) => ({
      branches: s.branches.map((b) =>
        b.id === branch.id ? { ...b, busy: true } : b,
      ),
    }));

    const userNode: CanvasNode = {
      id: mkId("user"),
      kind: "user",
      branchId: branch.id,
      position: {
        x: branch.xOrigin,
        y: branchTailY(branch, get().nodes),
      },
      text: prompt,
    };
    set((s) => ({ nodes: [...s.nodes, userNode] }));

    try {
      const isFirstTurnOfBranch = branch.sessionId === null;
      const isFork = isFirstTurnOfBranch && branch.flavor === "same_agent";
      const parentNode = branch.parentNodeId
        ? findNode(get().nodes, branch.parentNodeId)
        : undefined;
      const parentBranch = parentNode
        ? get().branches.find((b) => b.id === parentNode.branchId)
        : undefined;
      const resumeFrom = branch.sessionId ?? (isFork ? parentBranch?.sessionId ?? undefined : undefined);

      const island =
        branch.flavor === "new_island" && isFirstTurnOfBranch
          ? get().islands.find((i) => i.id === branch.islandId)
          : undefined;
      const appendSys = island?.persona || undefined;

      const spawnId = await spawnClaude({
        prompt,
        fork: isFork,
        cwd,
        allowed_tools: ["Read", "Bash", "Edit", "Write"],
        resume_from: resumeFrom,
        append_system_prompt: appendSys,
      });

      get().spawns.set(branch.id, spawnId);

      const unlisten = await subscribeEvents(
        spawnId,
        (e) => {
          set((s) => ({ events: [...s.events, e] }));

          if (e.type === "system" && e.subtype === "init") {
            set((s) => ({
              branches: s.branches.map((b) =>
                b.id === branch.id && !b.sessionId
                  ? { ...b, sessionId: e.session_id }
                  : b,
              ),
            }));
            return;
          }

          if (e.type === "assistant") {
            const { text, toolUses } = extractAssistant(e.message);
            if (!text && toolUses.length === 0) return;
            set((s) => {
              const b = s.branches.find((x) => x.id === branch.id);
              if (!b) return s;
              const node: CanvasNode = {
                id: mkId("assistant"),
                kind: "assistant",
                branchId: branch.id,
                position: { x: b.xOrigin, y: branchTailY(b, s.nodes) },
                text,
                toolUses,
                raw: e.message,
              };
              return { nodes: [...s.nodes, node] };
            });
            return;
          }

          if (e.type === "user") {
            const text = extractToolResult(e.message);
            if (!text) return;
            set((s) => {
              const b = s.branches.find((x) => x.id === branch.id);
              if (!b) return s;
              const node: CanvasNode = {
                id: mkId("tool_result"),
                kind: "tool_result",
                branchId: branch.id,
                position: { x: b.xOrigin, y: branchTailY(b, s.nodes) },
                text,
                raw: e.message,
              };
              return { nodes: [...s.nodes, node] };
            });
            return;
          }

          if (e.type === "result") {
            set((s) => ({
              branches: s.branches.map((b) =>
                b.id === branch.id ? { ...b, busy: false } : b,
              ),
            }));
          }
        },
        () => {
          set((s) => ({
            branches: s.branches.map((b) =>
              b.id === branch.id ? { ...b, busy: false } : b,
            ),
          }));
          get().spawns.delete(branch.id);
        },
      );

      get().unlistens.set(branch.id, unlisten);
    } catch (err) {
      set((s) => ({
        error: err instanceof Error ? err.message : String(err),
        branches: s.branches.map((b) =>
          b.id === branch.id ? { ...b, busy: false } : b,
        ),
      }));
    }
  },

  branchSameAgent: (fromNodeId: string) => {
    const { nodes, branches } = get();
    const parentNode = findNode(nodes, fromNodeId);
    if (!parentNode) return;
    const parentBranch = branches.find((b) => b.id === parentNode.branchId);
    if (!parentBranch?.sessionId) {
      set({
        error:
          "Cannot fork: parent branch has no session yet. Wait for first response.",
      });
      return;
    }

    const newBranch: Branch = {
      id: mkId("branch"),
      islandId: parentBranch.islandId,
      flavor: "same_agent",
      sessionId: null,
      parentNodeId: parentNode.id,
      xOrigin: rightmostX(branches) + NODE_WIDTH + BRANCH_X_GAP,
      yOrigin: parentNode.position.y,
      busy: false,
    };

    set((s) => ({
      branches: [...s.branches, newBranch],
      activeBranchId: newBranch.id,
      error: null,
    }));
  },

  branchNewIsland: (fromNodeId: string, persona?: string) => {
    const { nodes, branches, islands } = get();
    const parentNode = findNode(nodes, fromNodeId);
    if (!parentNode) return;

    const islandIndex = islands.length;
    const island: Island = {
      id: mkId("island"),
      index: islandIndex,
      name: `Island ${islandIndex}`,
      persona,
    };

    const newBranch: Branch = {
      id: mkId("branch"),
      islandId: island.id,
      flavor: "new_island",
      sessionId: null,
      parentNodeId: parentNode.id,
      xOrigin: rightmostX(branches) + NODE_WIDTH + NEW_ISLAND_X_GAP,
      yOrigin: parentNode.position.y,
      busy: false,
    };

    set((s) => ({
      islands: [...s.islands, island],
      branches: [...s.branches, newBranch],
      activeBranchId: newBranch.id,
      error: null,
    }));
  },

  setActiveBranch: (id: string) => {
    if (get().branches.some((b) => b.id === id)) {
      set({ activeBranchId: id });
    }
  },

  cancelActive: async () => {
    const { activeBranchId, spawns, unlistens } = get();
    const spawnId = spawns.get(activeBranchId);
    if (spawnId) await cancelClaude(spawnId).catch(() => {});
    const unlisten = unlistens.get(activeBranchId);
    if (unlisten) unlisten();
    unlistens.delete(activeBranchId);
    spawns.delete(activeBranchId);
    set((s) => ({
      branches: s.branches.map((b) =>
        b.id === activeBranchId ? { ...b, busy: false } : b,
      ),
    }));
  },

  reset: () => {
    const { unlistens, spawns } = get();
    for (const fn of unlistens.values()) fn();
    for (const sid of spawns.values()) cancelClaude(sid).catch(() => {});
    unlistens.clear();
    spawns.clear();
    set({ ...initialState(), cwd: get().cwd });
  },
}));

export function useActiveBranch(): Branch | undefined {
  return useWorkspace((s) => s.branches.find((b) => b.id === s.activeBranchId));
}

export function useActiveBusy(): boolean {
  return useWorkspace(
    (s) => s.branches.find((b) => b.id === s.activeBranchId)?.busy ?? false,
  );
}
