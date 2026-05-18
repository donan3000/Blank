import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { spawnClaude, subscribeEvents } from "./bridge/claude";
import type { ClaudeStreamEvent } from "./bridge/events";
import { PromptPill } from "./components/PromptPill";
import { DebugPanel } from "./components/DebugPanel";

export default function App() {
  const [events, setEvents] = useState<ClaudeStreamEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const handleSubmit = useCallback(async (prompt: string) => {
    setError(null);
    setBusy(true);
    try {
      const spawnId = await spawnClaude({
        prompt,
        fork: false,
        cwd: "/tmp",
        allowed_tools: ["Read", "Bash"],
      });
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      unlistenRef.current = await subscribeEvents(
        spawnId,
        (e) => setEvents((prev) => [...prev, e]),
        () => setBusy(false),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }, []);

  return (
    <div className="flex h-full w-full bg-canvas text-neutral-900">
      <main className="relative flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="flex flex-col items-center gap-3"
          >
            <h1 className="font-sans text-7xl font-semibold tracking-tight text-neutral-900">
              Canvas
            </h1>
            <p className="text-sm text-neutral-400">M1: CLI bridge proof</p>
          </motion.div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center px-6">
          <div className="pointer-events-auto w-full max-w-xl">
            <PromptPill onSubmit={handleSubmit} busy={busy} />
          </div>
        </div>
      </main>
      <DebugPanel events={events} error={error} />
    </div>
  );
}
