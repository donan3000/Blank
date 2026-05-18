import { motion } from "framer-motion";
import type { ClaudeStreamEvent } from "../bridge/events";

interface Props {
  events: ClaudeStreamEvent[];
  error?: string | null;
}

function eventBody(e: ClaudeStreamEvent): unknown {
  const { type: _t, ...rest } = e as { type: string } & Record<string, unknown>;
  void _t;
  return rest;
}

export function DebugPanel({ events, error }: Props) {
  return (
    <aside className="flex h-full w-[420px] shrink-0 flex-col border-l border-black/[0.04] bg-white/40">
      <header className="flex items-center justify-between px-5 py-4">
        <h2 className="text-[13px] font-medium uppercase tracking-wider text-neutral-500">
          Event Stream
        </h2>
        {error ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
            spawn failed: {error}
          </span>
        ) : (
          <span className="text-[11px] text-neutral-400">{events.length}</span>
        )}
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-6">
        {events.length === 0 && !error ? (
          <p className="px-2 pt-4 text-[13px] text-neutral-400">
            No events yet.
          </p>
        ) : null}
        {events.map((e, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="glass rounded-2xl border border-black/[0.06] bg-white/85 p-4 shadow-glass backdrop-blur-xl"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-neutral-900/90 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white">
                {e.type}
              </span>
              {"session_id" in e ? (
                <span className="truncate font-mono text-[10px] text-neutral-400">
                  {e.session_id.slice(0, 8)}
                </span>
              ) : null}
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-neutral-700">
              {JSON.stringify(eventBody(e), null, 2)}
            </pre>
          </motion.div>
        ))}
      </div>
    </aside>
  );
}
