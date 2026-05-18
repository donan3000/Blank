import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins } from "lucide-react";
import { useWorkspace } from "../store/workspace";

function fmt(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

export function CostMeter() {
  const costByIsland = useWorkspace((s) => s.costByIsland);
  const islands = useWorkspace((s) => s.islands);
  const [open, setOpen] = useState(false);

  const total = Object.values(costByIsland).reduce((a, b) => a + b, 0);
  const hasMultiple = islands.length > 1;

  return (
    <div
      onMouseEnter={() => hasMultiple && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="pointer-events-auto relative"
    >
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className="glass inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/85 px-3 py-1 font-mono text-[11px] text-neutral-700 shadow-glass backdrop-blur-xl"
      >
        <Coins size={11} className="text-neutral-400" />
        {fmt(total)}
      </motion.div>

      <AnimatePresence>
        {open && hasMultiple ? (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 460, damping: 30 }}
            className="glass absolute right-0 top-full mt-1 min-w-[180px] rounded-2xl border border-black/[0.06] bg-white/90 p-2 shadow-glass backdrop-blur-xl"
          >
            {islands.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between rounded-lg px-2 py-1 text-[12px]"
              >
                <span className="truncate text-neutral-700">{i.name ?? "Island"}</span>
                <span className="ml-3 font-mono text-[11px] text-neutral-500">
                  {fmt(costByIsland[i.id] ?? 0)}
                </span>
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
