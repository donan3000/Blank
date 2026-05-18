import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { Wrench } from "lucide-react";
import { NODE_WIDTH } from "../store/workspace";

interface AssistantData {
  text?: string;
  toolUses?: { id: string; name: string; input: unknown }[];
}

export function AssistantNode({ data }: NodeProps) {
  const { text = "", toolUses = [] } = data as AssistantData;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      style={{ width: NODE_WIDTH }}
      className="glass rounded-3xl border border-black/[0.06] bg-white/85 p-6 shadow-glass backdrop-blur-xl"
    >
      {text ? (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-900">
          {text}
        </p>
      ) : null}
      {toolUses.length > 0 ? (
        <div className={`flex flex-wrap gap-2 ${text ? "mt-4" : ""}`}>
          {toolUses.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1 font-mono text-[11px] text-neutral-600"
            >
              <Wrench size={11} strokeWidth={2.25} />
              {t.name}
            </span>
          ))}
        </div>
      ) : null}
      <Handle type="target" position={Position.Top} className="!h-0 !w-0 !opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!h-0 !w-0 !opacity-0" />
    </motion.div>
  );
}
