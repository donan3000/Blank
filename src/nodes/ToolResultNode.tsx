import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { NODE_WIDTH } from "../store/workspace";

const PREVIEW_CHARS = 280;

export function ToolResultNode({ data }: NodeProps) {
  const { text = "", dimmed = false, wiring = false } = data as {
    text?: string;
    dimmed?: boolean;
    wiring?: boolean;
  };
  const long = text.length > PREVIEW_CHARS;
  const [open, setOpen] = useState(false);
  const visible = long && !open ? text.slice(0, PREVIEW_CHARS) + "…" : text;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: dimmed ? 0.35 : 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      style={{ width: NODE_WIDTH }}
      className={`glass rounded-3xl border border-black/[0.04] bg-white/70 p-5 shadow-glass backdrop-blur-xl ${
        wiring ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-canvas" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-neutral-400">
        <span>Tool result</span>
        {long ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 normal-case tracking-normal text-neutral-500 hover:bg-black/[0.04]"
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {open ? "collapse" : "expand"}
          </button>
        ) : null}
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-neutral-700">
        {visible}
      </pre>
      <Handle type="target" position={Position.Top} className="!h-0 !w-0 !opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!h-0 !w-0 !opacity-0" />
    </motion.div>
  );
}
