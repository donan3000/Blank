# Canvas

A spatial-canvas wrapper around Claude Code: every message is a node on an infinite 2D map. The trunk grows down; from any past message you can branch sideways without disturbing the trunk. Branches use `--fork-session` so the parent transcript stays cached server-side — you pay cache-hit prices on history and full price only on the new turn.

The canvas hosts multiple **context islands**. Each island is its own Claude session (its own conversation, optionally its own persona). **Cross-island wires** explicitly transfer content from one node to another in raw / summary / custom-template form — no silent context bleed.

Runs on macOS, wrapping your existing Claude Code subscription (no separate API key needed).

> ⚠️ **Cost note (June 15, 2026):** Headless `claude -p` calls on subscription plans will start drawing from a separate Agent SDK credit pool. The branching cost wedge still works (cache hits on fork), but it stops being free under the existing Pro/Max quota. See https://code.claude.com/docs/en/headless.

## Status

**M1 — CLI bridge proof.** Tauri 2 + React skeleton, `tauri-plugin-shell` spawns `claude -p`, line-buffered stream-json parser, events emitted on `claude://event/<spawn_id>`, debug panel renders them.

Next: M2 trunk conversation on the canvas, M3 branching (same-agent + new-island), M4 rich rendering, M5 persistence, M6 cross-island wires.

## Prerequisites (Mac)

- `claude` CLI installed and logged in to a Pro/Max plan (`claude` once, follow the OAuth flow). Verify with `claude --version` (need a version with `--fork-session`).
- Node 20+ and pnpm 9+ (`brew install node pnpm`).
- Rust toolchain (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`).
- Xcode command-line tools (`xcode-select --install`).

## Run

```bash
pnpm install
pnpm tauri:dev
```

The Tauri window opens with the M1 debug shell. Type a prompt into the bottom pill, hit Enter — events stream into the right panel.

## Stack

- **Tauri 2.x** (Rust shell + WKWebView)
- **React + TypeScript + Vite**, Tailwind, Framer Motion, lucide-react
- **`@xyflow/react`** (React Flow) for the canvas — used from M2
- **SQLite** via `tauri-plugin-sql` — used from M5

## Layout

```
src/                React app
  bridge/           Tauri IPC + stream-json types
  components/       PromptPill, DebugPanel (and future node renderers)
  styles/
src-tauri/          Rust/Tauri backend
  src/
    claude_bridge.rs  spawn claude, parse stream-json, emit events
    commands.rs       #[tauri::command] entry points
    lib.rs            tauri::Builder wiring
  capabilities/     shell:allow-execute scoped to `claude`
  tauri.conf.json   CSP, window, bundle
```

## License

TBD.
