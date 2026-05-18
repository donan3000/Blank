import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";

interface Props {
  onSubmit: (prompt: string) => void;
  busy: boolean;
}

const MAX_HEIGHT = 96;

export function PromptPill({ onSubmit, busy }: Props) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const canSend = value.trim().length > 0 && !busy;

  const submit = () => {
    if (!canSend) return;
    onSubmit(value.trim());
    setValue("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="glass flex items-end gap-2 rounded-full border border-black/[0.06] bg-white/85 p-2 pl-5 shadow-glass backdrop-blur-xl"
    >
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask anything"
        rows={1}
        className="flex-1 resize-none self-center border-0 bg-transparent text-[15px] leading-6 text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        style={{ maxHeight: MAX_HEIGHT }}
      />
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={submit}
        disabled={!canSend}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-opacity disabled:opacity-30"
        aria-label="Send"
      >
        <ArrowUp size={18} strokeWidth={2.25} />
      </motion.button>
    </motion.div>
  );
}
