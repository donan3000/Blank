import { create } from "zustand";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { cancelClaude, spawnClaude, subscribeEvents } from "../bridge/claude";
import type { ClaudeStreamEvent } from "../bridge/events";
import {
  hydrate as hydrateDb,
  loadWorkspaceCwd,
  persistBranch,
  persistCrossEdge,
  persistIsland,
  persistNode,
  persistSpawn,
  updateWorkspaceCwd,
  wipeWorkspace,
} from "../bridge/db";

export type NodeKind = "user" | "assistant" | "tool_result";
export type BranchFlavor = "trunk" | "same_agent" | "new_island";
export type TransferMode = "raw" | "custom";

export interface CrossEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string | null;
  toBranchId: string;
  transferMode: TransferMode;
  template?: string;
  payloadPreview?: string;
}

export interface CanvasNode {
  id: string;
  kind: NodeKind;
  branchId: string;
  position: { x: number; y: number };
  text: string;
  toolUses?: { id: string; name: string; input: unknown }[];
  toolName?: string;
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
  crossEdges: CrossEdge[];
  activeBranchId: string;
  events: ClaudeStreamEvent[];
  error: string | null;
  cwd: string;
  hydrated: boolean;
  costByIsland: Record<string, number>;
  wiringFrom: string | null;
  streamingByBranch: Record<string, string>;
  unlistens: Map<string, UnlistenFn>;
  spawns: Map<string, string>;

  hydrate: () => Promise<void>;
  setCwd: (cwd: string) => Promise<void>;
  submit: (prompt: string, branchId?: string) => Promise<void>;
  branchSameAgent: (fromNodeId: string) => void;
  branchNewIsland: (fromNodeId: string, persona?: string) => void;
  createIsland: (persona?: string) => void;
  setActiveBranch: (id: string) => void;
  cancelActive: () => Promise<void>;
  startWiring: (fromNodeId: string) => void;
  cancelWiring: () => void;
  fireCrossEdge: (
    fromNodeId: string,
    toBranchId: string,
    mode: TransferMode,
    template?: string,
  ) => Promise<void>;
  reset: () => void;
  clearAll: () => Promise<void>;
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

function extractToolResult(message: unknown): { text: string; toolUseId?: string } {
  const parts: string[] = [];
  let toolUseId: string | undefined;
  for (const b of blocksOf(message)) {
    if (b.type !== "tool_result") continue;
    if (!toolUseId) {
      toolUseId = (b as { tool_use_id?: string }).tool_use_id;
    }
    if (typeof b.content === "string") parts.push(b.content);
    else if (Array.isArray(b.content)) {
      for (const c of b.content as MessageBlock[]) {
        if (c.type === "text" && typeof c.text === "string") parts.push(c.text);
      }
    }
  }
  return { text: parts.join("\n"), toolUseId };
}

function lookupToolName(
  nodes: CanvasNode[],
  branchId: string,
  toolUseId: string | undefined,
): string | undefined {
  if (!toolUseId) return undefined;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.branchId !== branchId) continue;
    if (!n.toolUses) continue;
    const hit = n.toolUses.find((t) => t.id === toolUseId);
    if (hit) return hit.name;
  }
  return undefined;
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
  "islands" | "branches" | "nodes" | "crossEdges" | "activeBranchId" | "events" | "error"
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
    crossEdges: [],
    activeBranchId: TRUNK_BRANCH_ID,
    events: [],
    error: null,
  };
}

export const useWorkspace = create<State>((set, get) => ({
  ...initialState(),
  cwd: "/tmp",
  hydrated: false,
  costByIsland: {},
  wiringFrom: null,
  streamingByBranch: {},
  unlistens: new Map(),
  spawns: new Map(),

  hydrate: async () => {
    try {
      const cwd = await loadWorkspaceCwd();
      const snap = await hydrateDb();
      if (snap.branches.length > 0) {
        const cost: Record<string, number> = {};
        const branchToIsland = new Map<string, string>();
        for (const b of snap.branches) branchToIsland.set(b.id, b.islandId);
        for (const s of snap.spawns) {
          const islandId = branchToIsland.get(s.branch_id);
          if (!islandId) continue;
          cost[islandId] = (cost[islandId] ?? 0) + s.cost_usd;
        }
        const activeBranchId =
          snap.branches.find((b) => b.flavor === "trunk")?.id ?? snap.branches[0].id;
        set({
          islands: snap.islands,
          branches: snap.branches,
          nodes: snap.nodes,
          crossEdges: snap.crossEdges,
          activeBranchId,
          costByIsland: cost,
          cwd,
          hydrated: true,
        });
      } else {
        const { islands, branches } = get();
        for (const island of islands) await persistIsland(island);
        for (const branch of branches) await persistBranch(branch);
        set({ cwd, hydrated: true });
      }
    } catch (err) {
      set({
        error: `db hydrate failed: ${err instanceof Error ? err.message : String(err)}`,
        hydrated: true,
      });
    }
  },

  setCwd: async (cwd: string) => {
    set({ cwd });
    await updateWorkspaceCwd(cwd).catch((err) => {
      set({
        error: `cwd persist failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    });
  },

  submit: async (prompt: string, branchId?: string) => {
    const targetBranchId = branchId ?? get().activeBranchId;
    const { branches, cwd, unlistens } = get();
    const branch = branches.find((b) => b.id === targetBranchId);
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
    persistNode(userNode).catch(console.error);

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
            let updated: Branch | undefined;
            set((s) => {
              const next = s.branches.map((b) => {
                if (b.id === branch.id && !b.sessionId) {
                  updated = { ...b, sessionId: e.session_id };
                  return updated;
                }
                return b;
              });
              return { branches: next };
            });
            if (updated) persistBranch(updated).catch(console.error);
            return;
          }

          if (e.type === "stream_event") {
            const inner = e.event as {
              type?: string;
              delta?: { type?: string; text?: string };
            };
            if (inner.type !== "content_block_delta") return;
            if (inner.delta?.type !== "text_delta") return;
            const deltaText = inner.delta.text ?? "";
            if (!deltaText) return;
            set((s) => {
              const existingId = s.streamingByBranch[branch.id];
              if (existingId) {
                return {
                  nodes: s.nodes.map((n) =>
                    n.id === existingId ? { ...n, text: n.text + deltaText } : n,
                  ),
                };
              }
              const b = s.branches.find((x) => x.id === branch.id);
              if (!b) return s;
              const newNode: CanvasNode = {
                id: mkId("assistant"),
                kind: "assistant",
                branchId: branch.id,
                position: { x: b.xOrigin, y: branchTailY(b, s.nodes) },
                text: deltaText,
              };
              return {
                nodes: [...s.nodes, newNode],
                streamingByBranch: {
                  ...s.streamingByBranch,
                  [branch.id]: newNode.id,
                },
              };
            });
            return;
          }

          if (e.type === "assistant") {
            const { text, toolUses } = extractAssistant(e.message);
            if (!text && toolUses.length === 0) return;
            const streamingId = get().streamingByBranch[branch.id];
            let finalNodeId: string | undefined;
            if (streamingId) {
              set((s) => {
                const rest = { ...s.streamingByBranch };
                delete rest[branch.id];
                return {
                  nodes: s.nodes.map((n) =>
                    n.id === streamingId
                      ? { ...n, text, toolUses, raw: e.message }
                      : n,
                  ),
                  streamingByBranch: rest,
                };
              });
              finalNodeId = streamingId;
            } else {
              let added: CanvasNode | undefined;
              set((s) => {
                const b = s.branches.find((x) => x.id === branch.id);
                if (!b) return s;
                added = {
                  id: mkId("assistant"),
                  kind: "assistant",
                  branchId: branch.id,
                  position: { x: b.xOrigin, y: branchTailY(b, s.nodes) },
                  text,
                  toolUses,
                  raw: e.message,
                };
                return { nodes: [...s.nodes, added] };
              });
              finalNodeId = added?.id;
            }
            const finalized = finalNodeId
              ? get().nodes.find((n) => n.id === finalNodeId)
              : undefined;
            if (finalized) persistNode(finalized).catch(console.error);
            return;
          }

          if (e.type === "user") {
            const { text, toolUseId } = extractToolResult(e.message);
            if (!text) return;
            let added: CanvasNode | undefined;
            set((s) => {
              const b = s.branches.find((x) => x.id === branch.id);
              if (!b) return s;
              added = {
                id: mkId("tool_result"),
                kind: "tool_result",
                branchId: branch.id,
                position: { x: b.xOrigin, y: branchTailY(b, s.nodes) },
                text,
                toolName: lookupToolName(s.nodes, branch.id, toolUseId),
                raw: e.message,
              };
              return { nodes: [...s.nodes, added] };
            });
            if (added) persistNode(added).catch(console.error);
            return;
          }

          if (e.type === "result") {
            const spawnIdForBranch = get().spawns.get(branch.id);
            const islandId = get().branches.find((b) => b.id === branch.id)?.islandId;
            set((s) => ({
              branches: s.branches.map((b) =>
                b.id === branch.id ? { ...b, busy: false } : b,
              ),
              costByIsland: islandId
                ? {
                    ...s.costByIsland,
                    [islandId]: (s.costByIsland[islandId] ?? 0) + e.total_cost_usd,
                  }
                : s.costByIsland,
            }));
            if (spawnIdForBranch) {
              persistSpawn({
                spawn_id: spawnIdForBranch,
                branch_id: branch.id,
                cost_usd: e.total_cost_usd,
                duration_ms: e.duration_ms,
                is_error: e.is_error,
              }).catch(console.error);
            }
          }
        },
        () => {
          const orphan = get().streamingByBranch[branch.id];
          set((s) => {
            const rest = { ...s.streamingByBranch };
            delete rest[branch.id];
            return {
              branches: s.branches.map((b) =>
                b.id === branch.id ? { ...b, busy: false } : b,
              ),
              streamingByBranch: rest,
            };
          });
          if (orphan) {
            const node = get().nodes.find((n) => n.id === orphan);
            if (node) persistNode(node).catch(console.error);
          }
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
    persistBranch(newBranch).catch(console.error);
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
    persistIsland(island).catch(console.error);
    persistBranch(newBranch).catch(console.error);
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

  createIsland: (persona?: string) => {
    const { branches, islands } = get();
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
      parentNodeId: null,
      xOrigin: rightmostX(branches) + NODE_WIDTH + NEW_ISLAND_X_GAP,
      yOrigin: 0,
      busy: false,
    };
    set((s) => ({
      islands: [...s.islands, island],
      branches: [...s.branches, newBranch],
      activeBranchId: newBranch.id,
      error: null,
    }));
    persistIsland(island).catch(console.error);
    persistBranch(newBranch).catch(console.error);
  },

  startWiring: (fromNodeId: string) => {
    if (!findNode(get().nodes, fromNodeId)) return;
    set({ wiringFrom: fromNodeId });
  },

  cancelWiring: () => set({ wiringFrom: null }),

  fireCrossEdge: async (fromNodeId, toBranchId, mode, template) => {
    const source = findNode(get().nodes, fromNodeId);
    if (!source) return;
    const payload =
      mode === "raw"
        ? source.text
        : (template ?? "{{content}}").replaceAll("{{content}}", source.text);

    const edge: CrossEdge = {
      id: mkId("xedge"),
      fromNodeId,
      toNodeId: null,
      toBranchId,
      transferMode: mode,
      template,
      payloadPreview: payload.slice(0, 600),
    };
    set((s) => ({
      crossEdges: [...s.crossEdges, edge],
      wiringFrom: null,
    }));

    await get().submit(payload, toBranchId);

    const lastUser = [...get().nodes]
      .reverse()
      .find((n) => n.branchId === toBranchId && n.kind === "user");
    const finalEdge = lastUser ? { ...edge, toNodeId: lastUser.id } : edge;
    if (lastUser) {
      set((s) => ({
        crossEdges: s.crossEdges.map((c) =>
          c.id === edge.id ? finalEdge : c,
        ),
      }));
    }
    persistCrossEdge(finalEdge).catch(console.error);
  },

  reset: () => {
    const { unlistens, spawns } = get();
    for (const fn of unlistens.values()) fn();
    for (const sid of spawns.values()) cancelClaude(sid).catch(() => {});
    unlistens.clear();
    spawns.clear();
  },

  clearAll: async () => {
    const { unlistens, spawns } = get();
    for (const fn of unlistens.values()) fn();
    for (const sid of spawns.values()) cancelClaude(sid).catch(() => {});
    unlistens.clear();
    spawns.clear();
    await wipeWorkspace();
    const fresh = initialState();
    set({ ...fresh, costByIsland: {}, hydrated: true });
    for (const island of fresh.islands) await persistIsland(island);
    for (const branch of fresh.branches) await persistBranch(branch);
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
