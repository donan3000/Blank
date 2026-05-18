import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { Wrench } from "lucide-react";
import { NODE_WIDTH } from "../store/workspace";
import { MarkdownView } from "../components/MarkdownView";

interface ToolUse {
  id: string;
  name: string;
  input: unknown;
}

interface AssistantData {
  text?: string;
  toolUses?: ToolUse[];
  dimmed?: boolean;
  wiring?: boolean;
}

function summarizeInput(name: string, input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const i = input as Record<string, unknown>;
  if (name === "Bash" && typeof i.command === "string") return i.command;
  if ((name === "Read" || name === "Edit" || name === "Write") && typeof i.file_path === "string") {
    return i.file_path as string;
  }
  return null;
}

function ToolUsePill({ tool }: { tool: ToolUse }) {
  const summary = summarizeInput(tool.name, tool.input);
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-black/[0.04] bg-black/[0.02] px-3 py-2">
      <Wrench size={12} strokeWidth={2.25} className="mt-1 text-neutral-500" />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          {tool.name}
        </div>
        {summary ? (
          <div className="mt-0.5 truncate font-mono text-[12px] text-neutral-800">
            {summary}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AssistantNode({ data }: NodeProps) {
  const { text = "", toolUses = [], dimmed = false, wiring = false } = data as AssistantData;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: dimmed ? 0.45 : 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      style={{ width: NODE_WIDTH }}
      className={`glass rounded-3xl border border-black/[0.06] bg-white/85 p-6 shadow-glass backdrop-blur-xl ${
        wiring ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-canvas" : ""
      }`}
    >
      {text ? <MarkdownView text={text} /> : null}
      {toolUses.length > 0 ? (
        <div className={`flex flex-col gap-2 ${text ? "mt-4" : ""}`}>
          {toolUses.map((t) => (
            <ToolUsePill key={t.id} tool={t} />
          ))}
        </div>
      ) : null}
      <Handle type="target" position={Position.Top} className="!h-0 !w-0 !opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!h-0 !w-0 !opacity-0" />
    </motion.div>
  );
}
