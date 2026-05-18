CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cwd TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE islands (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  name TEXT,
  persona TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  island_id TEXT NOT NULL REFERENCES islands(id) ON DELETE CASCADE,
  flavor TEXT NOT NULL,
  session_id TEXT,
  parent_node_id TEXT,
  x_origin REAL NOT NULL,
  y_origin REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  tool_uses_json TEXT,
  raw_json TEXT,
  x REAL NOT NULL,
  y REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE spawns (
  spawn_id TEXT PRIMARY KEY,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  cost_usd REAL,
  duration_ms INTEGER,
  is_error INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_nodes_workspace ON nodes(workspace_id);
CREATE INDEX idx_nodes_branch ON nodes(branch_id);
CREATE INDEX idx_branches_workspace ON branches(workspace_id);
CREATE INDEX idx_branches_island ON branches(island_id);
CREATE INDEX idx_spawns_branch ON spawns(branch_id);
