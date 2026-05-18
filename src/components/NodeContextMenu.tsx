import { motion } from "framer-motion";
import { GitBranch, Sparkles } from "lucide-react";
import { useWorkspace } from "../store/workspace";

interface Props {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function NodeContextMenu({ nodeId, x, y, onClose }: Props) {
  const branchSameAgent = useWorkspace((s) => s.branchSameAgent);
  const branchNewIsland = useWorkspace((s) => s.branchNewIsland);

  const handle = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 460, damping: 30 }}
      style={{ left: x, top: y }}
      className="glass fixed z-50 min-w-[220px] overflow-hidden rounded-2xl border border-black/[0.06] bg-white/90 p-1 shadow-glass backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={handle(() => branchSameAgent(nodeId))}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] text-neutral-900 hover:bg-black/[0.04]"
      >
        <GitBranch size={14} className="text-neutral-500" />
        <span className="flex-1">Branch same agent</span>
        <span className="font-mono text-[10px] text-neutral-400">fork</span>
      </button>
      <button
        type="button"
        onClick={handle(() => branchNewIsland(nodeId))}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] text-neutral-900 hover:bg-black/[0.04]"
      >
        <Sparkles size={14} className="text-neutral-500" />
        <span className="flex-1">Branch into new island</span>
        <span className="font-mono text-[10px] text-neutral-400">fresh</span>
      </button>
    </motion.div>
  );
}
