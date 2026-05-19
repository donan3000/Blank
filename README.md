# Canvas

A spatial-canvas wrapper around Claude Code. Every message is a node on an infinite 2D map. The trunk grows down; from any past message you can branch sideways without disturbing the trunk. Same-agent branches use `--fork-session` so the parent transcript stays cached server-side — you pay cache-hit prices on history and full price only on the new turn.

The canvas hosts multiple **context islands**, each its own Claude session with optional persona. **Cross-island wires** explicitly transfer content from one node to another in raw or templated form — no silent context bleed.

Runs on macOS, wrapping your existing Claude Code subscription (no separate API key).

> ⚠️ **Cost note (June 15, 2026):** Headless `claude -p` calls on subscription plans will start drawing from a separate Agent SDK credit pool. The branching wedge still works (cache hits on fork), but it stops being free under the existing Pro/Max quota. See https://code.claude.com/docs/en/headless.

## What works (v1)

| Feature | Notes |
|---|---|
| Trunk conversation | Vertical chat; `--resume` keeps the same session across turns. |
| Live token streaming | Assistant text streams token-by-token via `--include-partial-messages`; tool uses attach on the final message. |
| Same-agent branching | Right-click a node → "Branch same agent". Uses `--fork-session` so the parent transcript is cache-hit by the fork. |
| New-island branching | Right-click → "Branch into new island". Fresh session, optional persona via `--append-system-prompt`. |
| Standalone islands | "+ New island" button (top-left) creates an island with no parent. |
| Cross-island wires | Shift-click source node → shift-click target node in another island → modal picks raw / custom template with live preview before firing. |
| Markdown rendering | react-markdown + remark-gfm + rehype-highlight in assistant messages. |
| HTML preview | ` ```html` blocks get a Preview button → sandboxed iframe modal. |
| Tool-use display | Bash / Read / Edit / Write show command or file path inline. |
| Bash result rendering | Tool-result nodes for Bash render as dark terminal cards; other tools stay in the lighter style. |
| Working directory | Top-left folder chip opens a native picker; cwd persists per workspace. |
| Persistence | SQLite at the app's data dir; canvas, branches, islands, cross-edges, cost all survive close/reopen. |
| Cost meter | Top-right chip; hover for per-island breakdown. |
| Debug stream | `Cmd/Ctrl+D` toggles raw stream-json events panel. |

## Prerequisites (Mac)

- `claude` CLI installed and logged in to a Pro/Max plan. Verify with `claude --version`. **Needs a version with `--fork-session`** (run `claude --help | grep fork-session`).
- Node 20+ and pnpm 9+ (`brew install node pnpm`).
- Rust toolchain (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`).
- Xcode command-line tools (`xcode-select --install`).

## Run

```bash
pnpm install
pnpm tauri:dev
```

First launch hydrates an empty SQLite at `~/Library/Application Support/com.canvasclaude.app/canvas.db`.

## Try it

1. Type into the bottom pill, Enter — first turn lands on the trunk.
2. Right-click any assistant message → "Branch same agent" or "Branch into new island". The pill now writes to the new branch (top dropdown switches active branch).
3. Shift-click a node, then shift-click a node in another island → modal previews exactly what will be sent. Pick raw or write a custom template with `{{content}}`.
4. Use ` ```html` in a prompt-response cycle; click Preview to render it sandboxed.
5. Close the window and reopen — canvas restores.

## Stack

- **Tauri 2.x** — Rust shell + WKWebView, ~10MB bundle.
- **React + TypeScript + Vite**, Tailwind, Framer Motion, lucide-react.
- **@xyflow/react** — canvas (pan/zoom, nodes, edges).
- **react-markdown** + **rehype-highlight** for assistant rendering.
- **tauri-plugin-shell** to spawn `claude` children; **tauri-plugin-sql** for SQLite.
- **zustand** for client state.

## Layout

```
src/
  App.tsx                   layout shell
  canvas/Canvas.tsx         React Flow root; shift-click + edge wiring
  nodes/                    UserNode, AssistantNode, ToolResultNode
  components/
    PromptPill              chat input
    NodeContextMenu         right-click → Branch
    CrossEdgeModal          shift-click → wire preview + send
    NewIslandButton, BranchIndicator, CostMeter, DebugPanel, HtmlPreviewModal, MarkdownView
  bridge/
    claude.ts               invoke + event listeners
    db.ts                   SQLite hydrate / persist
    events.ts               stream-json types
  store/workspace.ts        zustand state + actions
src-tauri/
  src/
    claude_bridge.rs        spawn + parse stream-json + emit
    commands.rs             #[tauri::command] entry points
    lib.rs                  builder, plugins, migrations
  migrations/               0001 init, 0002 cross_edges
  capabilities/             shell:allow-spawn scoped to `claude`, sql perms
  tauri.conf.json
```

## Known caveats

- The `--allowed-tools` allowlist is hardcoded to `Read, Bash, Edit, Write`. To use Claude's other tools, edit `src/store/workspace.ts` `submit()` (per-workspace config will land in a later pass).
- Same-agent branching errors if the parent branch hasn't captured its `session_id` yet (i.e. before the first response). Wait for the trunk's first reply, then branch.
- `summary` transfer mode is not yet wired up; only `raw` and `custom` ship for cross-island wires.
- Edit/Write tool results don't render as side-by-side diffs yet; they fall back to the plain monospace card.
- App icons in `src-tauri/icons/` are 32x32 placeholders. Generate real ones with `pnpm tauri icon path/to/source.png` before distributing.
- macOS Gatekeeper / notarization is not configured; this builds as an unsigned `.app`.

## License

TBD.
