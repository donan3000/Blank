import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useWorkspace } from "../store/workspace";

export function BranchIndicator() {
  const branches = useWorkspace((s) => s.branches);
  const islands = useWorkspace((s) => s.islands);
  const activeId = useWorkspace((s) => s.activeBranchId);
  const setActive = useWorkspace((s) => s.setActiveBranch);

  if (branches.length <= 1) return null;

  const active = branches.find((b) => b.id === activeId);
  if (!active) return null;
  const island = islands.find((i) => i.id === active.islandId);

  const label =
    active.flavor === "trunk"
      ? "Trunk"
      : active.flavor === "same_agent"
        ? `Fork · ${island?.name ?? ""}`
        : `${island?.name ?? "Island"}`;

  return (
    <motion.label
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="glass pointer-events-auto inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/[0.06] bg-white/85 px-3 py-1 text-[12px] text-neutral-700 shadow-glass backdrop-blur-xl"
    >
      <span className="text-neutral-400">writing to</span>
      <span className="font-medium">{label}</span>
      <select
        value={activeId}
        onChange={(e) => setActive(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Switch active branch"
      >
        {branches.map((b) => {
          const i = islands.find((x) => x.id === b.islandId);
          const name =
            b.flavor === "trunk"
              ? "Trunk"
              : b.flavor === "same_agent"
                ? `Fork in ${i?.name ?? ""}`
                : `${i?.name ?? "Island"}`;
          return (
            <option key={b.id} value={b.id}>
              {name}
            </option>
          );
        })}
      </select>
      <ChevronDown size={12} className="text-neutral-400" />
    </motion.label>
  );
}
