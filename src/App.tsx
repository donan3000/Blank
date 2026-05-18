import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useActiveBusy, useWorkspace } from "./store/workspace";
import { Canvas } from "./canvas/Canvas";
import { PromptPill } from "./components/PromptPill";
import { DebugPanel } from "./components/DebugPanel";
import { NodeContextMenu } from "./components/NodeContextMenu";
import { BranchIndicator } from "./components/BranchIndicator";
import { CostMeter } from "./components/CostMeter";
import { CrossEdgeModal } from "./components/CrossEdgeModal";
import { NewIslandButton } from "./components/NewIslandButton";

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

interface CrossEdgeTarget {
  fromNodeId: string;
  toBranchId: string;
}

export default function App() {
  const submit = useWorkspace((s) => s.submit);
  const busy = useActiveBusy();
  const events = useWorkspace((s) => s.events);
  const error = useWorkspace((s) => s.error);
  const reset = useWorkspace((s) => s.reset);
  const hydrate = useWorkspace((s) => s.hydrate);
  const hydrated = useWorkspace((s) => s.hydrated);
  const nodeCount = useWorkspace((s) => s.nodes.length);
  const wiringFrom = useWorkspace((s) => s.wiringFrom);
  const cancelWiring = useWorkspace((s) => s.cancelWiring);
  const [showDebug, setShowDebug] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [crossEdge, setCrossEdge] = useState<CrossEdgeTarget | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "d" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowDebug((v) => !v);
      }
      if (e.key === "Escape") {
        setContextMenu(null);
        setCrossEdge(null);
        if (wiringFrom) cancelWiring();
      }
    };
    const onClickAnywhere = () => setContextMenu(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClickAnywhere);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClickAnywhere);
    };
  }, [wiringFrom, cancelWiring]);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  return (
    <div className="flex h-full w-full bg-canvas text-neutral-900">
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <Canvas
          onNodeContextMenu={(e, nodeId) =>
            setContextMenu({ nodeId, x: e.clientX, y: e.clientY })
          }
          onWiringTarget={(fromNodeId, toBranchId) =>
            setCrossEdge({ fromNodeId, toBranchId })
          }
        />

        <AnimatePresence>
          {nodeCount === 0 ? (
            <motion.div
              key="hero"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-3">
                <h1 className="font-sans text-7xl font-semibold tracking-tight text-neutral-900">
                  Canvas
                </h1>
                <p className="text-sm text-neutral-400">
                  Ask anything. Right-click to branch. Shift-click two
                  nodes to wire islands.
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="pointer-events-none absolute left-4 top-4 flex flex-col items-start gap-2">
          <NewIslandButton />
        </div>

        <div className="pointer-events-none absolute right-4 top-4 flex flex-col items-end gap-2">
          <CostMeter />
          {error ? (
            <span className="rounded-full bg-red-100 px-3 py-1 text-[12px] font-medium text-red-700 shadow-glass">
              {error}
            </span>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 px-6">
          <BranchIndicator />
          <div className="pointer-events-auto w-full max-w-xl">
            <PromptPill onSubmit={submit} busy={busy} />
          </div>
        </div>

        <AnimatePresence>
          {wiringFrom ? (
            <motion.div
              key="wiring-hint"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-none absolute inset-x-0 top-16 flex justify-center"
            >
              <span className="glass rounded-full border border-indigo-200/60 bg-indigo-50/80 px-3 py-1 text-[12px] font-medium text-indigo-700 shadow-glass">
                Shift-click a node in another island to wire — Esc to cancel
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {contextMenu ? (
            <NodeContextMenu
              nodeId={contextMenu.nodeId}
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
            />
          ) : null}
        </AnimatePresence>

        <CrossEdgeModal
          fromNodeId={crossEdge?.fromNodeId ?? null}
          toBranchId={crossEdge?.toBranchId ?? null}
          onClose={() => {
            setCrossEdge(null);
            cancelWiring();
          }}
        />
      </main>

      <AnimatePresence>
        {showDebug ? (
          <motion.div
            key="debug"
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <DebugPanel events={events} error={error} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
