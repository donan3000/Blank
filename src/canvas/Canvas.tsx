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
  type CrossEdge,
} from "../store/workspace";

interface Props {
  onNodeContextMenu?: (
    e: { clientX: number; clientY: number },
    nodeId: string,
  ) => void;
  onWiringTarget?: (fromNodeId: string, toBranchId: string) => void;
}

function toRF(n: CanvasNode, activeBranchId: string, wiringFrom: string | null): Node {
  return {
    id: n.id,
    type: n.kind,
    position: n.position,
    data: {
      text: n.text,
      toolUses: n.toolUses,
      dimmed: n.branchId !== activeBranchId,
      wiring: n.id === wiringFrom,
    },
    draggable: false,
    selectable: false,
  };
}

function parentEdges(branches: Branch[]): Edge[] {
  const edges: Edge[] = [];
  for (const b of branches) {
    if (!b.parentNodeId) continue;
    edges.push({
      id: `pedge-${b.id}`,
      source: b.parentNodeId,
      target: `${b.id}:first`,
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

function crossEdgesToRF(edges: CrossEdge[]): Edge[] {
  return edges
    .filter((e) => e.toNodeId)
    .map((e) => ({
      id: `xedge-${e.id}`,
      source: e.fromNodeId,
      target: e.toNodeId as string,
      type: "bezier",
      style: {
        stroke: "rgba(99,102,241,0.5)",
        strokeWidth: 1.5,
        strokeDasharray: "5 4",
      },
    }));
}

function resolveFirstMarkers(edges: Edge[], nodes: CanvasNode[]): Edge[] {
  return edges
    .map((e) => {
      if (!e.target.endsWith(":first")) return e;
      const branchId = e.target.slice(0, -":first".length);
      const first = nodes.find((n) => n.branchId === branchId);
      if (!first) return null;
      return { ...e, target: first.id };
    })
    .filter((e): e is Edge => e !== null);
}

function CanvasInner({ onNodeContextMenu, onWiringTarget }: Props) {
  const nodes = useWorkspace((s) => s.nodes);
  const branches = useWorkspace((s) => s.branches);
  const crossEdges = useWorkspace((s) => s.crossEdges);
  const activeId = useWorkspace((s) => s.activeBranchId);
  const wiringFrom = useWorkspace((s) => s.wiringFrom);
  const startWiring = useWorkspace((s) => s.startWiring);
  const cancelWiring = useWorkspace((s) => s.cancelWiring);
  const { setCenter } = useReactFlow();

  const rfNodes = useMemo(
    () => nodes.map((n) => toRF(n, activeId, wiringFrom)),
    [nodes, activeId, wiringFrom],
  );

  const rfEdges = useMemo(() => {
    const parents = resolveFirstMarkers(parentEdges(branches), nodes);
    const crosses = crossEdgesToRF(crossEdges);
    return [...parents, ...crosses];
  }, [branches, nodes, crossEdges]);

  useEffect(() => {
    const active = branches.find((b) => b.id === activeId);
    if (!active) return;
    const branchNodes = nodes.filter((n) => n.branchId === active.id);
    const target = branchNodes[branchNodes.length - 1];
    const x = (target?.position.x ?? active.xOrigin) + NODE_WIDTH / 2;
    const y = (target?.position.y ?? active.yOrigin) + 120;
    setCenter(x, y, { duration: 500, zoom: 1 });
  }, [nodes, branches, activeId, setCenter]);

  const handleContextMenu: NodeMouseHandler = (event, node) => {
    if (!onNodeContextMenu) return;
    event.preventDefault();
    onNodeContextMenu(
      { clientX: event.clientX, clientY: event.clientY },
      node.id,
    );
  };

  const handleClick: NodeMouseHandler = (event, node) => {
    if (!event.shiftKey) return;
    const target = nodes.find((n) => n.id === node.id);
    if (!target) return;
    if (!wiringFrom) {
      startWiring(node.id);
      return;
    }
    const source = nodes.find((n) => n.id === wiringFrom);
    if (!source) {
      cancelWiring();
      return;
    }
    if (source.branchId === target.branchId) {
      cancelWiring();
      return;
    }
    onWiringTarget?.(source.id, target.branchId);
  };

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      onNodeContextMenu={handleContextMenu}
      onNodeClick={handleClick}
      onPaneClick={() => wiringFrom && cancelWiring()}
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
