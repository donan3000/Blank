import { useEffect } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "../nodes";
import { NODE_WIDTH, useWorkspace, type CanvasNode } from "../store/workspace";

function toRF(n: CanvasNode): Node {
  return {
    id: n.id,
    type: n.kind,
    position: n.position,
    data: { text: n.text, toolUses: n.toolUses },
    draggable: false,
    selectable: false,
  };
}

function CanvasInner() {
  const nodes = useWorkspace((s) => s.nodes);
  const { setCenter } = useReactFlow();

  useEffect(() => {
    if (nodes.length === 0) return;
    const last = nodes[nodes.length - 1];
    setCenter(last.position.x + NODE_WIDTH / 2, last.position.y + 120, {
      duration: 500,
      zoom: 1,
    });
  }, [nodes.length, setCenter]);

  return (
    <ReactFlow
      nodes={nodes.map(toRF)}
      nodeTypes={nodeTypes}
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

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
