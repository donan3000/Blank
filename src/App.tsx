import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useActiveBusy, useWorkspace } from "./store/workspace";
import { Canvas } from "./canvas/Canvas";
import { PromptPill } from "./components/PromptPill";
import { DebugPanel } from "./components/DebugPanel";
import { NodeContextMenu } from "./components/NodeContextMenu";
import { BranchIndicator } from "./components/BranchIndicator";

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

export default function App() {
  const submit = useWorkspace((s) => s.submit);
  const busy = useActiveBusy();
  const events = useWorkspace((s) => s.events);
  const error = useWorkspace((s) => s.error);
  const reset = useWorkspace((s) => s.reset);
  const nodeCount = useWorkspace((s) => s.nodes.length);
  const [showDebug, setShowDebug] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "d" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowDebug((v) => !v);
      }
      if (e.key === "Escape") setContextMenu(null);
    };
    const onClickAnywhere = () => setContextMenu(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClickAnywhere);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClickAnywhere);
    };
  }, []);

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
                  Ask anything. Right-click a message to branch.
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 px-6">
          <BranchIndicator />
          <div className="pointer-events-auto w-full max-w-xl">
            <PromptPill onSubmit={submit} busy={busy} />
          </div>
        </div>

        {error ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
            <span className="rounded-full bg-red-100 px-3 py-1 text-[12px] font-medium text-red-700 shadow-glass">
              {error}
            </span>
          </div>
        ) : null}

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
