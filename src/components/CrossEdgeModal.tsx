import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import {
  useWorkspace,
  type TransferMode,
} from "../store/workspace";

interface Props {
  fromNodeId: string | null;
  toBranchId: string | null;
  onClose: () => void;
}

const DEFAULT_TEMPLATE = "Critique this from a security angle:\n\n{{content}}";

function estTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

export function CrossEdgeModal({ fromNodeId, toBranchId, onClose }: Props) {
  const nodes = useWorkspace((s) => s.nodes);
  const branches = useWorkspace((s) => s.branches);
  const islands = useWorkspace((s) => s.islands);
  const fireCrossEdge = useWorkspace((s) => s.fireCrossEdge);
  const [mode, setMode] = useState<TransferMode>("raw");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  const source = useMemo(
    () => (fromNodeId ? nodes.find((n) => n.id === fromNodeId) : undefined),
    [fromNodeId, nodes],
  );
  const targetBranch = useMemo(
    () => (toBranchId ? branches.find((b) => b.id === toBranchId) : undefined),
    [toBranchId, branches],
  );
  const targetIsland = targetBranch
    ? islands.find((i) => i.id === targetBranch.islandId)
    : undefined;

  const payload =
    mode === "raw"
      ? source?.text ?? ""
      : template.replaceAll("{{content}}", source?.text ?? "");

  const open = !!(fromNodeId && toBranchId && source && targetBranch);

  const send = async () => {
    if (!fromNodeId || !toBranchId) return;
    await fireCrossEdge(fromNodeId, toBranchId, mode, mode === "custom" ? template : undefined);
    onClose();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="relative flex max-h-[80vh] w-[640px] flex-col overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-glass"
          >
            <header className="flex items-center justify-between border-b border-black/[0.04] px-5 py-3">
              <div className="flex items-center gap-2 text-[13px] text-neutral-700">
                <span className="font-medium">cross-island wire</span>
                <ArrowRight size={12} className="text-neutral-400" />
                <span className="text-neutral-500">
                  {targetIsland?.name ?? "Island"}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-neutral-500 hover:bg-black/[0.04]"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-3 flex gap-1 rounded-full bg-black/[0.04] p-1">
                {(["raw", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex-1 rounded-full px-3 py-1.5 text-[12px] font-medium capitalize transition ${
                      mode === m
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {mode === "custom" ? (
                <textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  rows={4}
                  className="mb-3 w-full resize-none rounded-2xl border border-black/[0.06] bg-black/[0.02] p-3 font-mono text-[12.5px] leading-relaxed text-neutral-800 focus:outline-none"
                  placeholder="Use {{content}} where the source should appear"
                />
              ) : null}

              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-neutral-400">
                  preview · what gets sent
                </span>
                <span className="font-mono text-[11px] text-neutral-400">
                  ~{estTokens(payload)} tokens
                </span>
              </div>
              <pre className="max-h-[260px] overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-black/[0.06] bg-black/[0.02] p-3 font-mono text-[12px] leading-relaxed text-neutral-800">
                {payload || "(empty)"}
              </pre>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-black/[0.04] px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-1.5 text-[13px] text-neutral-600 hover:bg-black/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={send}
                disabled={!payload.trim()}
                className="rounded-full bg-neutral-900 px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-30"
              >
                Send
              </button>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
