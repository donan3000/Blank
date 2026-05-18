import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { NODE_WIDTH } from "../store/workspace";

export function UserNode({ data }: NodeProps) {
  const text = (data as { text?: string }).text ?? "";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      style={{ width: NODE_WIDTH }}
      className="rounded-3xl bg-neutral-900 px-6 py-5 text-white shadow-glass"
    >
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{text}</p>
      <Handle type="target" position={Position.Top} className="!h-0 !w-0 !opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!h-0 !w-0 !opacity-0" />
    </motion.div>
  );
}
