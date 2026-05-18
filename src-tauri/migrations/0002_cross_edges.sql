CREATE TABLE cross_edges (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT,
  to_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  transfer_mode TEXT NOT NULL,
  template TEXT,
  payload_preview TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_cross_edges_workspace ON cross_edges(workspace_id);
CREATE INDEX idx_cross_edges_from ON cross_edges(from_node_id);
CREATE INDEX idx_cross_edges_to ON cross_edges(to_branch_id);
