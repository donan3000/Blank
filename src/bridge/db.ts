import Database from "@tauri-apps/plugin-sql";
import type {
  Branch,
  CanvasNode,
  CrossEdge,
  Island,
  NodeKind,
  BranchFlavor,
  TransferMode,
} from "../store/workspace";

const DB_URL = "sqlite:canvas.db";
const DEFAULT_WORKSPACE_ID = "ws-default";
const DEFAULT_WORKSPACE_NAME = "Default";
const DEFAULT_CWD = "/tmp";

let dbPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load(DB_URL);
  return dbPromise;
}

async function ensureWorkspace(): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO workspaces (id, name, cwd, created_at)
     VALUES ($1, $2, $3, $4)`,
    [DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_NAME, DEFAULT_CWD, Date.now()],
  );
}

export interface SpawnRecord {
  spawn_id: string;
  branch_id: string;
  cost_usd: number;
  duration_ms: number;
  is_error: boolean;
}

export interface Snapshot {
  islands: Island[];
  branches: Branch[];
  nodes: CanvasNode[];
  crossEdges: CrossEdge[];
  spawns: SpawnRecord[];
}

export async function hydrate(): Promise<Snapshot> {
  await ensureWorkspace();
  const db = await getDb();

  const islandRows = await db.select<
    { id: string; idx: number; name: string | null; persona: string | null }[]
  >(`SELECT id, idx, name, persona FROM islands
       WHERE workspace_id = $1 ORDER BY idx ASC`, [DEFAULT_WORKSPACE_ID]);

  const branchRows = await db.select<
    {
      id: string;
      island_id: string;
      flavor: string;
      session_id: string | null;
      parent_node_id: string | null;
      x_origin: number;
      y_origin: number;
    }[]
  >(
    `SELECT id, island_id, flavor, session_id, parent_node_id, x_origin, y_origin
       FROM branches WHERE workspace_id = $1 ORDER BY created_at ASC`,
    [DEFAULT_WORKSPACE_ID],
  );

  const nodeRows = await db.select<
    {
      id: string;
      branch_id: string;
      kind: string;
      text: string;
      tool_uses_json: string | null;
      x: number;
      y: number;
    }[]
  >(
    `SELECT id, branch_id, kind, text, tool_uses_json, x, y
       FROM nodes WHERE workspace_id = $1 ORDER BY created_at ASC`,
    [DEFAULT_WORKSPACE_ID],
  );

  const spawnRows = await db.select<
    {
      spawn_id: string;
      branch_id: string | null;
      cost_usd: number | null;
      duration_ms: number | null;
      is_error: number;
    }[]
  >(
    `SELECT spawn_id, branch_id, cost_usd, duration_ms, is_error
       FROM spawns ORDER BY created_at ASC`,
  );

  const islands: Island[] = islandRows.map((r) => ({
    id: r.id,
    index: r.idx,
    name: r.name ?? undefined,
    persona: r.persona ?? undefined,
  }));

  const branches: Branch[] = branchRows.map((r) => ({
    id: r.id,
    islandId: r.island_id,
    flavor: r.flavor as BranchFlavor,
    sessionId: r.session_id,
    parentNodeId: r.parent_node_id,
    xOrigin: r.x_origin,
    yOrigin: r.y_origin,
    busy: false,
  }));

  const nodes: CanvasNode[] = nodeRows.map((r) => ({
    id: r.id,
    kind: r.kind as NodeKind,
    branchId: r.branch_id,
    position: { x: r.x, y: r.y },
    text: r.text,
    toolUses: r.tool_uses_json ? JSON.parse(r.tool_uses_json) : undefined,
  }));

  const spawns: SpawnRecord[] = spawnRows.map((r) => ({
    spawn_id: r.spawn_id,
    branch_id: r.branch_id ?? "",
    cost_usd: r.cost_usd ?? 0,
    duration_ms: r.duration_ms ?? 0,
    is_error: r.is_error === 1,
  }));

  const crossEdgeRows = await db.select<
    {
      id: string;
      from_node_id: string;
      to_node_id: string | null;
      to_branch_id: string;
      transfer_mode: string;
      template: string | null;
      payload_preview: string | null;
    }[]
  >(
    `SELECT id, from_node_id, to_node_id, to_branch_id, transfer_mode, template, payload_preview
       FROM cross_edges WHERE workspace_id = $1 ORDER BY created_at ASC`,
    [DEFAULT_WORKSPACE_ID],
  );

  const crossEdges: CrossEdge[] = crossEdgeRows.map((r) => ({
    id: r.id,
    fromNodeId: r.from_node_id,
    toNodeId: r.to_node_id,
    toBranchId: r.to_branch_id,
    transferMode: r.transfer_mode as TransferMode,
    template: r.template ?? undefined,
    payloadPreview: r.payload_preview ?? undefined,
  }));

  return { islands, branches, nodes, crossEdges, spawns };
}

export async function persistIsland(island: Island): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO islands (id, workspace_id, idx, name, persona, created_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT created_at FROM islands WHERE id = $1), $6))`,
    [
      island.id,
      DEFAULT_WORKSPACE_ID,
      island.index,
      island.name ?? null,
      island.persona ?? null,
      Date.now(),
    ],
  );
}

export async function persistBranch(branch: Branch): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO branches
      (id, workspace_id, island_id, flavor, session_id, parent_node_id, x_origin, y_origin, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
       COALESCE((SELECT created_at FROM branches WHERE id = $1), $9))`,
    [
      branch.id,
      DEFAULT_WORKSPACE_ID,
      branch.islandId,
      branch.flavor,
      branch.sessionId,
      branch.parentNodeId,
      branch.xOrigin,
      branch.yOrigin,
      Date.now(),
    ],
  );
}

export async function persistNode(node: CanvasNode): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO nodes
      (id, workspace_id, branch_id, kind, text, tool_uses_json, raw_json, x, y, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
       COALESCE((SELECT created_at FROM nodes WHERE id = $1), $10))`,
    [
      node.id,
      DEFAULT_WORKSPACE_ID,
      node.branchId,
      node.kind,
      node.text,
      node.toolUses ? JSON.stringify(node.toolUses) : null,
      null,
      node.position.x,
      node.position.y,
      Date.now(),
    ],
  );
}

export async function persistSpawn(record: SpawnRecord): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO spawns
      (spawn_id, branch_id, cost_usd, duration_ms, is_error, created_at)
     VALUES ($1, $2, $3, $4, $5,
       COALESCE((SELECT created_at FROM spawns WHERE spawn_id = $1), $6))`,
    [
      record.spawn_id,
      record.branch_id,
      record.cost_usd,
      record.duration_ms,
      record.is_error ? 1 : 0,
      Date.now(),
    ],
  );
}

export async function persistCrossEdge(edge: CrossEdge): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO cross_edges
      (id, workspace_id, from_node_id, to_node_id, to_branch_id, transfer_mode, template, payload_preview, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
       COALESCE((SELECT created_at FROM cross_edges WHERE id = $1), $9))`,
    [
      edge.id,
      DEFAULT_WORKSPACE_ID,
      edge.fromNodeId,
      edge.toNodeId,
      edge.toBranchId,
      edge.transferMode,
      edge.template ?? null,
      edge.payloadPreview ?? null,
      Date.now(),
    ],
  );
}

export async function wipeWorkspace(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM cross_edges WHERE workspace_id = $1`, [DEFAULT_WORKSPACE_ID]);
  await db.execute(`DELETE FROM spawns`);
  await db.execute(`DELETE FROM nodes WHERE workspace_id = $1`, [DEFAULT_WORKSPACE_ID]);
  await db.execute(`DELETE FROM branches WHERE workspace_id = $1`, [DEFAULT_WORKSPACE_ID]);
  await db.execute(`DELETE FROM islands WHERE workspace_id = $1`, [DEFAULT_WORKSPACE_ID]);
}
