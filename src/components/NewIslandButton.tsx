import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useWorkspace } from "../store/workspace";

export function NewIslandButton() {
  const createIsland = useWorkspace((s) => s.createIsland);
  return (
    <motion.button
      type="button"
      onClick={() => createIsland()}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="glass pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/85 px-3 py-1 text-[12px] text-neutral-700 shadow-glass backdrop-blur-xl hover:bg-white"
    >
      <Plus size={12} strokeWidth={2.5} />
      New island
    </motion.button>
  );
}
