import { motion } from "framer-motion";
import { Folder } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspace } from "../store/workspace";

function shorten(cwd: string): string {
  if (!cwd) return "—";
  if (cwd.startsWith("/Users/")) {
    const parts = cwd.split("/").filter(Boolean);
    if (parts.length <= 3) return "~/" + parts.slice(2).join("/");
    return "~/" + parts.slice(-2).join("/");
  }
  if (cwd === "/tmp") return "/tmp";
  const segs = cwd.split("/").filter(Boolean);
  return segs.length <= 2 ? cwd : ".../" + segs.slice(-2).join("/");
}

export function CwdButton() {
  const cwd = useWorkspace((s) => s.cwd);
  const setCwd = useWorkspace((s) => s.setCwd);

  const pick = async () => {
    try {
      const result = await open({ directory: true, multiple: false });
      if (typeof result === "string") await setCwd(result);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <motion.button
      type="button"
      onClick={pick}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="glass pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/85 px-3 py-1 font-mono text-[11px] text-neutral-700 shadow-glass backdrop-blur-xl hover:bg-white"
      title={cwd}
    >
      <Folder size={11} className="text-neutral-400" />
      {shorten(cwd)}
    </motion.button>
  );
}
