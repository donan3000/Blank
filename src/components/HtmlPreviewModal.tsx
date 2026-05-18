import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface Props {
  html: string | null;
  onClose: () => void;
}

export function HtmlPreviewModal({ html, onClose }: Props) {
  useEffect(() => {
    if (!html) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [html, onClose]);

  return (
    <AnimatePresence>
      {html ? (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="relative flex h-[80vh] w-[80vw] max-w-[1100px] flex-col overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-glass"
          >
            <header className="flex items-center justify-between border-b border-black/[0.04] px-5 py-3">
              <span className="text-[12px] font-medium uppercase tracking-wider text-neutral-500">
                HTML preview · sandboxed
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-neutral-500 hover:bg-black/[0.04]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </header>
            <iframe
              title="HTML preview"
              sandbox="allow-scripts"
              srcDoc={html}
              className="flex-1 border-0 bg-white"
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
