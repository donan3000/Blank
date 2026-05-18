import { useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "../nodes";
import {
  NODE_WIDTH,
  useWorkspace,
  type Branch,
  type CanvasNode,
} from "../store/workspace";

interface Props {
  onNodeContextMenu?: (
    e: { clientX: number; clientY: number },
    nodeId: string,
  ) => void;
}

function toRF(n: CanvasNode, activeBranchId: string): Node {
  return {
    id: n.id,
    type: n.kind,
    position: n.position,
    data: {
      text: n.text,
      toolUses: n.toolUses,
      dimmed: n.branchId !== activeBranchId,
    },
    draggable: false,
    selectable: false,
  };
}

function buildEdges(branches: Branch[]): Edge[] {
  const edges: Edge[] = [];
  for (const b of branches) {
    if (!b.parentNodeId) continue;
    const targetFirstNode = `${b.id}:first`;
    // Edge from parent node to first node of branch — we use a marker target id
    // that is replaced by the actual first node id when available.
    edges.push({
      id: `edge-${b.id}`,
      source: b.parentNodeId,
      target: targetFirstNode,
      type: "smoothstep",
      style: {
        stroke: b.flavor === "new_island" ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.25)",
        strokeWidth: 1.5,
        strokeDasharray: b.flavor === "new_island" ? "6 4" : undefined,
      },
    });
  }
  return edges;
}

function resolveEdges(edges: Edge[], nodes: CanvasNode[], branches: Branch[]): Edge[] {
  return edges
    .map((e) => {
      if (!e.target.endsWith(":first")) return e;
      const branchId = e.target.slice(0, -":first".length);
      const first = nodes.find((n) => n.branchId === branchId);
      if (!first) return null;
      const branch = branches.find((b) => b.id === branchId);
      if (!branch) return null;
      return { ...e, target: first.id };
    })
    .filter((e): e is Edge => e !== null);
}

function CanvasInner({ onNodeContextMenu }: Props) {
  const nodes = useWorkspace((s) => s.nodes);
  const branches = useWorkspace((s) => s.branches);
  const activeId = useWorkspace((s) => s.activeBranchId);
  const { setCenter } = useReactFlow();

  const rfNodes = useMemo(
    () => nodes.map((n) => toRF(n, activeId)),
    [nodes, activeId],
  );
  const rfEdges = useMemo(
    () => resolveEdges(buildEdges(branches), nodes, branches),
    [branches, nodes],
  );

  useEffect(() => {
    const active = branches.find((b) => b.id === activeId);
    if (!active) return;
    const branchNodes = nodes.filter((n) => n.branchId === active.id);
    const target = branchNodes[branchNodes.length - 1];
    if (!target) {
      setCenter(active.xOrigin + NODE_WIDTH / 2, active.yOrigin + 120, {
        duration: 500,
        zoom: 1,
      });
      return;
    }
    setCenter(target.position.x + NODE_WIDTH / 2, target.position.y + 120, {
      duration: 500,
      zoom: 1,
    });
  }, [nodes, branches, activeId, setCenter]);

  const handleContextMenu: NodeMouseHandler = (event, node) => {
    if (!onNodeContextMenu) return;
    event.preventDefault();
    onNodeContextMenu(
      { clientX: event.clientX, clientY: event.clientY },
      node.id,
    );
  };

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      onNodeContextMenu={handleContextMenu}
      panOnDrag={[0, 1, 2]}
      panOnScroll
      zoomOnPinch
      zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: true }}
      minZoom={0.3}
      maxZoom={1.4}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1.2}
        color="rgba(0,0,0,0.06)"
      />
    </ReactFlow>
  );
}

export function Canvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
