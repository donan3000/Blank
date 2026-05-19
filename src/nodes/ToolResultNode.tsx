import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown, ChevronRight, Terminal } from "lucide-react";
import { NODE_WIDTH } from "../store/workspace";

const PREVIEW_CHARS = 280;

interface ToolResultData {
  text?: string;
  toolName?: string;
  dimmed?: boolean;
  wiring?: boolean;
}

function BashResult({ text, long, open, onToggle }: {
  text: string;
  long: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const visible = long && !open ? text.slice(0, PREVIEW_CHARS) + "…" : text;
  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-neutral-950">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
          <Terminal size={11} strokeWidth={2.25} />
          bash
        </span>
        {long ? (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/80 hover:bg-white/20"
          >
            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            {open ? "collapse" : "expand"}
          </button>
        ) : null}
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words p-3 font-mono text-[12.5px] leading-relaxed text-emerald-100">
        {visible || "(no output)"}
      </pre>
    </div>
  );
}

export function ToolResultNode({ data }: NodeProps) {
  const { text = "", toolName, dimmed = false, wiring = false } = data as ToolResultData;
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
      {toolName === "Bash" ? (
        <BashResult text={text} long={long} open={open} onToggle={() => setOpen((v) => !v)} />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-neutral-400">
            <span>{toolName ? toolName.toLowerCase() : "tool"} result</span>
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
        </>
      )}
      <Handle type="target" position={Position.Top} className="!h-0 !w-0 !opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!h-0 !w-0 !opacity-0" />
    </motion.div>
  );
}
