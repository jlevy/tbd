# Research: Claude Code Orchestration Interfaces and UIs

**Date:** 2026-02-15 (last updated 2026-03-09, expanded cmux/Symphony/Multiclaude)

**Author:** Research brief (AI-assisted)

**Status:** In Progress

**Related:**

- [Running Claude Code Across Environments](research-running-claude-code.md) — Multi-agent
  orchestration ecosystem survey (orchestration frameworks, execution environments,
  inter-agent communication)
- [Claude Code Sub-Agents](research-claude-code-sub-agents.md) — Internal sub-agent
  architecture, model configuration, compaction/handoff patterns
- [API References for Bridge Integrations](api-references-bridge-integrations.md) —
  Multi-agent protocols (MCP, ACP, A2A, ANP) and bridge APIs

* * *

## Overview

This document investigates the different **interfaces, protocols, and user-facing surfaces**
through which Claude Code can be controlled, used, and orchestrated. While the companion
research docs cover the broader multi-agent ecosystem and Claude Code's internal sub-agent
system, this doc focuses on the control layer: *how* you connect to Claude Code, *through*
what UI surfaces, and *what protocols* enable external orchestration.

The landscape has evolved rapidly. Claude Code is no longer just a CLI tool — it has become
a platform with multiple control protocols, IDE integrations, and a growing ecosystem of
third-party UIs that wrap, extend, or replace the default interfaces.

## Questions to Answer

1. What are the distinct approaches to programmatically controlling Claude Code?
2. How do the two undocumented WebSocket protocols (IDE integration and SDK control) work?
3. What is ACP and why did Anthropic decline native support?
4. What UI surfaces exist for Claude Code (terminal, VS Code, native app, cloud, third-party)?
5. How can Claude Code instances be orchestrated from other Claude Code instances?
6. What third-party wrappers and UIs exist, and what control protocols do they use?
7. How do these approaches compare for different use cases?

## Scope

- **Included:** Claude Code's external control protocols (`--remote`, `--sdk-url`, IDE
  integration WebSocket, ACP adapter, Agent SDK), UI surfaces (terminal, VS Code, desktop
  app, cloud/web, third-party GUIs/TUIs), third-party wrapper projects, orchestration of
  Claude Code instances from external controllers or from other Claude Code instances
- **Excluded:** Internal sub-agent architecture (covered in
  research-claude-code-sub-agents.md), multi-agent orchestration frameworks like Gas Town,
  Claude Squad, or Agent Mail (covered in research-running-claude-code.md), non-Claude-Code
  AI agent systems (Codex, Gemini CLI, etc. except as comparison points)

* * *

## Findings

### 1. The Four Approaches to Controlling Claude Code

Claude Code can be controlled through four fundamentally different approaches, ranging from
simple CLI scripting to full WebSocket protocol integration.

#### Approach 1: `claude --remote` and `&` Prefix (Simplest — Uses Max Plan)

The simplest way to orchestrate Claude Code in the cloud. Requires a **Claude Max
subscription**.

**How `--remote` works:**
- `claude --remote "description"` creates a session on Anthropic's cloud infrastructure
- The session runs in an isolated sandbox VM that clones your GitHub repository
- Sessions are accessible via shareable URLs on claude.ai
- `claude --teleport [session-id]` resumes remote sessions from any machine
- Authentication requires `ANTHROPIC_AUTH_TOKEN` or `CLAUDE_CODE_OAUTH_TOKEN` — an
  `ANTHROPIC_API_KEY` alone won't work ("Remote sessions require claude.ai account")

**How `&` prefix works (from within a session):**
- Prefixing a message with `&` dispatches the task to Claude Code on the Web
- Creates a new, independent web session with conversation context (one-way handoff)
- Multiple `&` commands create parallel sessions
- Monitor with `/tasks`, interact on claude.ai or Claude iOS app
- Pull back with `/teleport` or `/tp`

**Scripting with `setup-token`:**
- `claude setup-token` generates a long-lived OAuth token for automated environments
- Set `CLAUDE_CODE_OAUTH_TOKEN=<token>` in CI/CD, containers, or remote machines
- Works with GitHub Actions, Coder.com, Depot, and general containerized environments
- **Known issue** ([#8938](https://github.com/anthropics/claude-code/issues/8938)): Fresh
  containers where Claude was never run still walk through the startup wizard even with
  the token set
- `ANTHROPIC_API_KEY` and `CLAUDE_CODE_OAUTH_TOKEN` cannot coexist — only one auth method
  at a time

**When to use:** Quick cloud execution, scripted CI/CD pipelines, zero-infrastructure
orchestration. Ideal for piping a tbd issue body into a cloud session.

#### Approach 2: The Two Undocumented WebSocket Protocols

Claude Code has two distinct WebSocket-based protocols, each serving a different purpose.

##### 2a. IDE Integration Protocol (JSON-RPC 2.0 / MCP over WebSocket)

This protocol connects Claude Code to IDE features — it's how Claude Code knows about
your editor state.

**Architecture:**
- The VS Code extension (or JetBrains plugin) starts a **WebSocket server** on a random
  localhost port
- A lock file is written to `~/.claude/ide/[port].lock` with connection info:
  ```json
  {
    "pid": 12345,
    "workspaceFolders": ["/path/to/project"],
    "ideName": "VS Code",
    "transport": "ws",
    "authToken": "550e8400-e29b-41d4-a716-446655440000"
  }
  ```
- Environment variables `CLAUDE_CODE_SSE_PORT` and `ENABLE_IDE_INTEGRATION=true` are set
- The Claude CLI connects as a **client** to the IDE's server
- Authentication via `x-claude-code-ide-authorization` header (added after
  **CVE-2025-52882** — a vulnerability where unauthenticated WebSocket access allowed
  malicious websites to brute-force ports and execute arbitrary operations)

**The 12 MCP Tools exposed by the IDE:**

| Tool | Purpose |
| --- | --- |
| `openFile` | Open a file in the editor with optional range selection |
| `openDiff` | Open a git diff comparison view |
| `getCurrentSelection` | Get current text selection in active editor |
| `getLatestSelection` | Retrieve most recent selection across all editors |
| `getOpenEditors` | List currently open editor tabs (URI, active status, language) |
| `getWorkspaceFolders` | Get all workspace folders |
| `getDiagnostics` | Get language diagnostics (errors, warnings) by file |
| `checkDocumentDirty` | Check if a document has unsaved changes |
| `saveDocument` | Save a document to disk |
| `close_tab` | Close an open editor tab |
| `closeAllDiffTabs` | Close all diff view tabs |
| `executeCode` | Execute code within the IDE environment |

**IDE-to-Claude notifications:**
- `selection_changed` — user selects text (includes `text`, `filePath`, positions)
- `at_mentioned` — user explicitly sends selection as context

**Reimplementations:**
- **Neovim:** [coder/claudecode.nvim](https://github.com/coder/claudecode.nvim) — pure
  Lua, zero-dependency reimplementation with comprehensive PROTOCOL.md and ARCHITECTURE.md
  documentation. Selection tracking via autocmds (`CursorMoved`, `CursorMovedI`,
  `ModeChanged`, `BufEnter`). Supports headless/external terminal mode for tmux setups.
  Notable fork: [snirt/claudecode.nvim](https://github.com/snirt/claudecode.nvim) adds
  multiple simultaneous sessions with isolated state.
- **Emacs:** Community implementations exist
- **Zed:** Uses ACP adapter instead (see Approach 3)

**When to use:** Building IDE plugins that need Claude Code to understand editor context.
Not for general programmatic control — use `--sdk-url` for that.

##### 2b. SDK Control Protocol (`--sdk-url` — The Real Prize)

The hidden `--sdk-url` flag transforms Claude Code CLI into a **WebSocket client** that
connects to YOUR server, giving full programmatic control over sessions.

**Launch command:**
```bash
claude --sdk-url ws://localhost:8765 \
  --print --output-format stream-json \
  --input-format stream-json -p ""
```
The `-p` prompt is ignored in `--sdk-url` mode — the CLI awaits messages from your server.

**NDJSON Transport Format:**
All communication uses newline-delimited JSON over a single bidirectional WebSocket
connection. Empty lines between messages are acceptable.

**Server → CLI messages:**

| Type | Purpose |
| --- | --- |
| `user` | Send prompts and follow-up messages |
| `control_response` | Permission approvals/denials |
| `control_cancel_request` | Cancel pending operations |
| `keep_alive` | Heartbeat |
| `update_environment_variables` | Runtime environment changes |

**CLI → Server messages:**

| Type | Purpose |
| --- | --- |
| `system` (subtype: `init`) | First message — session ID, working dir, tools, MCP servers, model, version |
| `assistant` | Full LLM responses with content blocks (text/tool_use/thinking) |
| `result` | Query completion signal |
| `stream_event` | Token-by-token streaming (requires `--verbose`) |
| `tool_progress` / `tool_use_summary` | Tool execution updates |
| `control_request` | Permission asks (e.g., `can_use_tool`) |
| `auth_status` | Authentication state |

**13 Control Protocol Subtypes:**
`initialize`, `can_use_tool`, `interrupt`, `set_permission_mode`, `set_model`,
`set_max_thinking_tokens`, `mcp_status`, `mcp_message`, `mcp_reconnect`, `mcp_toggle`,
`mcp_set_servers`, `rewind_files`, `hook_callback`

**6 Transport Implementations (from source analysis):**
- **ProcessInputTransport**: Base NDJSON parser
- **SdkUrlTransport**: Bridge for `--sdk-url` mode
- **WebSocketTransport**: Pure WebSocket with auto-reconnect and 10-second keepalive pings
- **HybridTransport**: WebSocket receive + HTTP POST send (for unreliable uplinks)
- **MFA/WFA**: Web UI session management
- **DirectConnectWebSocket**: Simplified browser client

**Authentication:** HTTP upgrade headers carry `Authorization: Bearer <session_access_token>`
plus optional `X-Environment-Runner-Version` and `X-Last-Request-Id` (on reconnect).

**Key reference:** The
[Companion project's WEBSOCKET_PROTOCOL_REVERSED.md](https://github.com/The-Vibe-Company/companion)
is the most comprehensive public documentation, created by reverse-engineering Claude Code's
internals.

**When to use:** Building custom UIs, orchestration systems, or programmatic controllers
for Claude Code. This is how you'd build a VS Code extension with full session lifecycle
control.

**Caveat:** This is a reverse-engineered, undocumented protocol. It could change without
notice in any Claude Code update.

#### Approach 3: ACP (Agent Client Protocol)

ACP is an **open standard** (Apache-licensed) positioning itself as "the LSP for AI agents."
It standardizes communication between code editors and AI agents using JSON-RPC over stdio.

**Created by:** Zed Industries + Google. ACP reuses MCP specifications where possible, adding
custom types for agent-specific concerns (planning, permissions, session management).

**Anthropic's response:** Anthropic closed
[Issue #6686](https://github.com/anthropics/claude-code/issues/6686) as "NOT_PLANNED"
despite significant community interest (440+ thumbs-up, 114+ hearts, 36+ comments). The
decision reflects a strategic preference for Anthropic's own integration paths
(`--sdk-url`, official extensions, Agent SDK) rather than adopting the emerging standard.

**The adapter workaround:**
[`@zed-industries/claude-code-acp`](https://github.com/zed-industries/claude-code-acp)
wraps the Claude Agent SDK, translating to ACP's JSON-RPC format. Install via
`npm i -g @zed-industries/claude-code-acp`.

**Editor support for ACP:**

| Category | Implementations |
| --- | --- |
| **Editors** | Zed, Neovim (CodeCompanion, avante.nvim), JetBrains (co-developer), Emacs (agent-shell), Eclipse (prototype), Obsidian, Marimo |
| **Agents** | Claude Code (via adapter), Gemini CLI (native), Codex CLI, OpenHands, Goose (by Block), StackPack, OpenCode |

**Current limitations with Claude Code via ACP in Zed:** No editing past messages, no
resuming threads from history, no checkpointing. Plan mode is being added. More capabilities
depend on Anthropic expanding SDK support.

**ACP vs MCP:**
- **MCP** handles the "what" — what data and tools can agents access
- **ACP** handles the "where" — where the agent lives in your workflow

**When to use:** If you want cross-editor portability and a standard protocol. Most relevant
for Zed users today. VS Code doesn't natively support ACP yet.

#### Approach 4: Claude Agent SDK (Official, Runs on Your Infra)

The officially supported programmatic path. Available in TypeScript and Python.

**TypeScript V2 preview:**
```typescript
import { createSession } from "@anthropic-ai/claude-code/v2";
const session = await createSession({ workdir: "/path" });
const response = await session.send("Fix the bug");
for await (const event of response.stream()) { /* ... */ }
```

**Python SDK:**
```python
from claude_code_sdk import claude_code
result = claude_code(
    prompt="Fix the bug",
    model="opus",
    options={"allowed_tools": ["Read", "Edit", "Bash"]}
)
```

**Key differences from other approaches:**
- Requires an **API key** (not your Max subscription) — bills at API rates
- Officially supported and documented
- Runs on your infrastructure (not Anthropic cloud)
- Clean session management and streaming APIs
- Structured output support with JSON schema validation

**When to use:** Production systems, custom tools, and orchestration services where you want
official support and API-key billing. This is what powers `@zed-industries/claude-code-acp`
and most server-side wrappers.

### 2. UI Surfaces for Claude Code

Claude Code can be accessed through multiple user interfaces, each with different
capabilities and trade-offs.

#### 2a. Terminal (CLI)

The original and most powerful interface.

**Capabilities:**
- Full CLI flag control (`--model`, `--system-prompt`, `--max-turns`, `--max-budget-usd`,
  etc.)
- Headless mode (`claude -p`) for scripting and automation
- Session management (`--session-id`, `--continue`, `--resume`, `--fork-session`)
- YOLO/dangerously-skip-permissions mode for autonomous execution
- Hooks system (PreToolUse, PostToolUse, Stop, SessionStart, etc.)
- Sub-agent spawning via Task tool
- Agent teams (experimental)
- Custom sub-agents via `--agents` flag

**Strengths:** Maximum control, scriptable, composable with Unix tools, works everywhere.

**Weaknesses:** No visual diff views, no inline code annotations, requires terminal
familiarity, no point-and-click file selection.

**Multiplexer patterns:**
- Claude Squad: tmux-based multi-session management with git worktree isolation
- Conductor: macOS app for parallel agent orchestration with worktrees
- Manual tmux/screen setups for side-by-side sessions

#### 2b. VS Code Extension (Official)

Anthropic's official VS Code integration.

**Architecture:** The extension runs a WebSocket server (IDE Integration Protocol) and
launches the Claude Code CLI as a subprocess. The CLI connects to the extension's WebSocket
to access editor-aware MCP tools.

**Capabilities:**
- Chat panel within VS Code
- Access to 12 MCP tools (openFile, openDiff, getDiagnostics, etc.)
- Inline diff views and code annotations
- Selection-aware context passing
- Diagnostic integration (TypeScript errors, ESLint, etc.)
- File tree awareness

**Strengths:** Tight IDE integration, visual diff views, code navigation, familiar VS Code
UI.

**Weaknesses:** Single-session (no parallel agents), Anthropic-controlled UX (can't
customize chat UI), limited to VS Code ecosystem.

#### 2c. JetBrains Plugin (Official)

Official JetBrains integration (IntelliJ IDEA, PyCharm, WebStorm, etc.).

**Architecture:** Same IDE Integration Protocol as VS Code — WebSocket server, lock file
discovery, MCP tools.

**Status:** Generally available. JetBrains is also a co-developer of the ACP standard,
planning deeper ACP integration.

#### 2d. Claude Desktop / Native App

Standalone desktop application.

**Capabilities:**
- Project picker and session management
- Settings UI for model selection, permissions
- `/model opus` and other slash commands during sessions
- MCP server configuration
- Same core CLI engine under the hood

**Strengths:** Dedicated workspace, no IDE overhead, clean UI.

**Weaknesses:** Less IDE integration than VS Code/JetBrains (no inline diffs, no
diagnostics).

#### 2e. Claude Code Cloud (Web)

Browser-based execution on Anthropic infrastructure.

**Architecture:** Isolated sandbox VMs with filesystem and network isolation. Only authorized
repos are accessible. `.env` files are blocked. Network connections go through a proxy.

**Capabilities:**
- Full Claude Code functionality in the browser
- Session environment configuration (env vars in `.env` format)
- GitHub repository cloning and access
- Shareable session URLs
- Accessible from Claude iOS app

**Strengths:** No local setup, cloud compute, accessible from anywhere, sandbox isolation.

**Weaknesses:** No custom MCP servers, no local filesystem access, limited to authorized
repos, no cross-session communication, sandbox restrictions on background processes.

**Configuration methods:**
- `.claude/settings.json` (committed to repo) — works in cloud
- Cloud environment dialog (env vars in `.env` format)
- `/model` command during session
- `~/.claude/settings.json` and `.claude/settings.local.json` do NOT work in cloud

#### 2f. Third-Party UIs

An ecosystem of alternative interfaces has emerged, each leveraging one of the control
protocols.

| Project | Type | Protocol | Key Feature |
| --- | --- | --- | --- |
| [Paperclip](https://github.com/paperclipai/paperclip) | Web control plane | REST API (agent-agnostic) | Company-level orchestration: org charts, budgets, heartbeats, governance |
| [OpCode](https://github.com/winfunc/opcode) | Tauri desktop app | Agent SDK / process | Custom AI agents, session versioning, checkpoint viz (20k+ stars) |
| [Claudia](https://github.com/marcusbey/claudia) (Asterisk, YC) | Tauri desktop app | CLI wrapper | Session time travel, sandboxed background agents |
| [Claude Code Chat](https://github.com/andrepimenta/claude-code-chat) | VS Code extension | CLI wrapper | Chat panel interface, WSL support |
| [Claudix](https://github.com/Haleclipse/Claudix) | VS Code extension (Vue 3) | Agent SDK | Shares data with local Claude Code, DI architecture |
| [Companion](https://github.com/The-Vibe-Company/companion) | Browser/mobile UI | `--sdk-url` WebSocket | Full session control from browser, no extra API key |
| [CodePilot](https://github.com/op7418/CodePilot) | Electron desktop app | CLI wrapper | Session pause/resume/rewind, Telegram/Discord bridge |
| [Claude Squad](https://github.com/smtg-ai/claude-squad) | TUI orchestrator | CLI + tmux | Multi-agent tmux sessions with git worktrees (6k+ stars) |
| [myclaude](https://github.com/stellarlinkco/myclaude) | CLI orchestrator | Multi-agent CLI | Cross-agent orchestration (Claude, Codex, Gemini, OpenCode) |
| [Sandbox Agent](https://github.com/rivet-dev/sandbox-agent) | HTTP API adapter | Universal (per-agent) | Swap agents with config, streaming events, single Rust binary |
| [claude-agent-server](https://github.com/dzhng/claude-agent-server) | WebSocket server | Agent SDK | E2B sandbox deployment, real-time streaming |
| [Toad](https://willmcgugan.github.io/toad-released/) | TUI (Textual) | ACP | Unified terminal UI for any ACP-enabled agent |

##### OpCode (formerly Claudia by winfunc)

Tauri 2 desktop "command center" for Claude Code. React 18 + TypeScript frontend, Rust
backend, SQLite via rusqlite. Key features: custom AI agents with JSON configs, session
versioning with checkpoints, fork sessions, background execution via Rust async runtime,
agent library for team sharing. 75% less memory than Electron. AGPL license, no subscription
fees.

##### Claudia (by Asterisk, YC-backed)

Separate project from OpCode despite sharing the name. Tauri + React + Rust. 20k+ GitHub
stars. Features: session time travel with checkpoints and branching ("chats like Git"),
sandboxed background agents (experimental), visual MCP server management, token usage
dashboards. OS-level security with Linux seccomp and macOS Seatbelt. AGPL license. Must
build from source.

##### Companion (The-Vibe-Company)

The most technically interesting wrapper — uses the reverse-engineered `--sdk-url` WebSocket
protocol to provide browser/mobile control of Claude Code sessions. Architecture:
Browser (React) ↔ Companion Server (Bun + Hono) ↔ Claude CLI (via `--sdk-url`).
No additional API key needed — plugs into existing Claude subscription. Contains the
definitive `WEBSOCKET_PROTOCOL_REVERSED.md`. Caveat: reverse-engineered protocol could break.

##### Toad

Created by Will McGugan (creator of Rich and Textual Python frameworks). A TUI providing a
unified terminal interface for any ACP-enabled agent (Claude Code, Gemini CLI, OpenHands,
etc.). The name comes from "textual code." Represents the ACP ecosystem's answer to having
one UI for all agents — analogous to how a terminal emulator can run any shell.

##### Sandbox Agent (Rivet)

Solves the fragmentation problem: Claude Code uses JSONL over stdout, Codex uses JSON-RPC,
OpenCode uses HTTP+SSE. Sandbox Agent provides **one HTTP API** to interact with all of them.
Universal session schema, streaming SSE events, single Rust binary. Supports E2B, Daytona,
Vercel Sandboxes. Open-sourced January 2026.

##### Paperclip (NEW — March 2026)

**The most architecturally novel project in this survey.** Paperclip is not another
coding-agent orchestrator — it's a **company-level control plane** for autonomous AI
organizations. The tagline: *"If OpenClaw is an employee, Paperclip is the company."*

Open-sourced March 5-6, 2026. 4.3k+ GitHub stars within days. Node.js + React + PostgreSQL
(PGlite embedded for local dev). MIT licensed. Created by "dotta."

**Core concepts:**

- **Company as first-order object:** Everything (agents, tasks, goals, budgets) is scoped
  to a company. One Paperclip instance can manage multiple companies.
- **Agents as employees:** Each agent gets a role, title, reporting line (org chart),
  capabilities description, and adapter config. The CEO agent reviews executives; engineers
  pick tasks from the backlog.
- **Goal hierarchy:** All work traces back to the company mission through a chain of parent
  tasks: `current task → parent → ... → company goal`. This is what keeps autonomous agents
  aligned — they can always answer "why am I doing this?"
- **Heartbeat system:** Agents wake on scheduled intervals, check assigned work, execute
  autonomously, report back. Two adapter modes: `process` (Paperclip spawns a shell command
  / Claude Code session) and `http` (fire-and-forget webhook to external agent).
- **Monthly token budgets:** Per-agent budgets with soft alerts and hard-stop auto-pause at
  100%. Cost events tracked per agent, task, project, and company. Prevents runaway spend.
- **Board governance:** Human "board" operator approves agent hires, CEO strategy proposals,
  and can pause/override any agent or task. Append-only audit trail.
- **Atomic task checkout:** Single assignee model with atomic `in_progress` transitions to
  prevent duplicate execution.

**Agent integration (adapter architecture):**

Paperclip is agent-agnostic. The adapter config defines how each agent runs:

```
Adapter types:
  process → spawn Claude Code, OpenClaw, Codex, or any CLI as subprocess
  http    → POST webhook to externally running agent (OpenClaw hooks, custom APIs)
```

The adapter config is opaque to Paperclip — it passes through whatever the agent runtime
expects (CLAUDE.md content for Claude Code, SOUL.md for OpenClaw, CLI args for scripts).

**What makes it novel vs. other orchestrators:**

| Dimension | Gas Town / Claude Squad / CC Mirror | Paperclip |
| --- | --- | --- |
| **Abstraction level** | Individual coding sessions | Entire company |
| **Agent identity** | Ad-hoc (per session) | Persistent employees with roles |
| **Task model** | Flat or manual | Hierarchical goal chain |
| **Cost control** | Manual / per-invocation budget | Monthly budgets per agent |
| **Governance** | None | Board approvals, audit trail |
| **Agent scope** | Claude Code only | Any agent runtime |
| **Persistence** | Session-based | PostgreSQL (survives restarts) |

**Relevance to Claude Code orchestration:** Paperclip represents the highest-level
abstraction in this space — it sits *above* the orchestration frameworks covered in
`research-running-claude-code.md` (Gas Town, Claude Squad) and the control protocols
covered in this doc. A Paperclip deployment might use Claude Code's Agent SDK or
`claude -p` as the adapter backend, while Paperclip handles the organizational layer:
who does what, within what budget, toward what goal.

##### CodePilot (NEW — March 2026)

Desktop GUI for Claude Code built with Electron + Next.js. Features session
pause/resume/rewind, split-screen view, cost tracking, and bridges to Telegram, Discord,
QQ, and Feishu for mobile session control. v0.26.0 as of March 4, 2026.

##### Claude Squad (NEW)

Terminal TUI managing multiple agents (Claude Code, Aider, Codex, OpenCode, Amp) in
separate tmux sessions with git worktrees. 5.6k+ stars. Install via
`brew install claude-squad` (runs as `cs`). More of a session manager than an orchestrator
— each agent works independently in its own worktree.

##### myclaude (NEW)

Multi-agent orchestration across Claude Code, Codex, Gemini, and OpenCode. 2.4k stars,
74 releases, v6.8.2 as of March 3, 2026. High release velocity suggests active
development.

### 3. Orchestrating Claude Code Instances from Claude Code

Three patterns exist for meta-orchestration — using Claude Code to control other Claude Code
instances.

#### Pattern 1: `claude -p` from Bash (Outer Loop)

The most straightforward pattern. Claude Code spawns other Claude Code instances as
subprocesses via the Bash tool.

```bash
# Basic: Claude Code invokes Claude Code
claude -p "Analyze auth.py and fix security issues" \
  --allowedTools "Read,Edit,Bash" \
  --model opus \
  --max-turns 20 \
  --output-format json
```

**Advantages:** Arbitrary nesting depth (unlike native sub-agents which are limited to one
level), full CLI control, complete isolation, budget limits per invocation.

**Disadvantages:** Higher latency (process startup), no shared context, no prompt caching
across invocations.

This is covered in depth in the sub-agents research doc (Section 7: "Ralph Wiggum Loops").

#### Pattern 2: `claude --remote` Scripted Dispatch

Spawn cloud sessions programmatically:

```bash
# Pipe a tbd issue into a cloud session
tbd show $BEAD_ID --json | jq -r '.description' | \
  claude --remote "Implement this feature"
```

Each `--remote` call creates an independent cloud session. Multiple calls run in parallel.
The orchestrating instance can monitor progress via git (checking for pushed commits/PRs) or
by pulling sessions back with `--teleport`.

**Limitation:** No direct communication between cloud sessions. Coordination must happen
through Git (commits, PRs, issues) or an external mechanism like tbd sync.

#### Pattern 3: `--sdk-url` Programmatic Control

Build a WebSocket server that manages multiple Claude Code CLI connections:

```
Orchestrator Server (your code)
  ├── claude --sdk-url ws://localhost:8765/session-1
  ├── claude --sdk-url ws://localhost:8765/session-2
  └── claude --sdk-url ws://localhost:8765/session-3
```

The server sends prompts, receives results, approves tool use, and coordinates across
sessions. This provides the most fine-grained control but requires implementing the
NDJSON protocol.

### 4. Comparative Analysis

#### Protocol Comparison

| Dimension | `--remote` | `--sdk-url` | IDE Protocol | ACP | Agent SDK |
| --- | --- | --- | --- | --- | --- |
| **Direction** | CLI → Anthropic cloud | CLI → your server | CLI → IDE server | Agent → editor (stdio) | Your code → CLI (library) |
| **Transport** | HTTPS | WebSocket (NDJSON) | WebSocket (JSON-RPC) | stdio (JSON-RPC) | In-process / subprocess |
| **Auth model** | OAuth (Max plan) | Bearer token | Lock file UUID | N/A (local process) | API key |
| **Billing** | Max subscription | Max subscription | Max subscription | Depends on agent | API rates |
| **Control level** | Session-level | Full (prompt, tools, model, permissions) | Read-only (editor state) | Session-level | Full (programmatic) |
| **Documentation** | Official | Reverse-engineered | Reverse-engineered (Neovim) | Open standard | Official |
| **Stability** | Stable | May break | May break | Standard, evolving | Stable |
| **Multi-session** | Yes (parallel cloud) | Yes (multiple connections) | No (per-IDE) | Per-editor | Yes (multiple instances) |

#### UI Surface Comparison

| Surface | Control Level | IDE Integration | Multi-Agent | Cloud Execution | Custom UI |
| --- | --- | --- | --- | --- | --- |
| **Terminal CLI** | Maximum | None | Via tmux/scripts | Via `--remote` | N/A |
| **VS Code** | High | Full (12 MCP tools) | Single session | Via `&` prefix | No |
| **JetBrains** | High | Full | Single session | Via `&` prefix | No |
| **Desktop App** | Medium | None | Single session | N/A | No |
| **Cloud (Web)** | Medium | None | Independent sessions | Native | No |
| **OpCode** | High | Custom agents | Via agent system | N/A | Yes (Tauri) |
| **Claudia** | Medium | None | Background agents (exp.) | N/A | Yes (Tauri) |
| **Companion** | High | None | Yes (--sdk-url) | N/A | Yes (Browser) |
| **Toad** | Medium | None | Yes (ACP multi-agent) | N/A | Yes (TUI) |
| **Sandbox Agent** | High | None | Yes (HTTP API) | Via sandbox providers | API only |

### 5. The ACP Ecosystem Question

ACP represents a potentially significant fork in the Claude Code interface landscape. Two
competing visions exist:

**Anthropic's vision:** Control Claude Code through official channels — the VS Code/JetBrains
extensions, the Agent SDK, `--remote` for cloud, and (undocumented) `--sdk-url` for power
users. Keep the integration tight and maintain control over the experience.

**The ACP vision:** A universal standard where any editor can host any agent. Zed, Google,
JetBrains, and the open-source community are building toward this. Claude Code participates
via the adapter, but as a second-class citizen compared to agents with native ACP support
(Gemini CLI, Codex, OpenHands).

**Current state:** The adapter works but has limitations. The gap between native ACP
support (Gemini CLI) and adapter-mediated support (Claude Code) creates friction — no editing
past messages, no resuming from history, no checkpointing when using Claude Code through ACP
in Zed.

**Anthropic ToS crackdown (February 18, 2026):** Anthropic banned OAuth tokens from
consumer Pro/Max plans in third-party tools. Claude Code itself (terminal, ACP adapter, or
Obsidian plugin) remains supported, but wrapping Claude Code's OAuth auth in custom
third-party UIs now violates Terms of Service. This creates a friction point for projects
like Companion that rely on the `--sdk-url` protocol with Max plan auth.

**Strategic implication:** If ACP gains critical mass (JetBrains as co-developer is a strong
signal), pressure on Anthropic to provide native support will increase. The
[closed issue #6686](https://github.com/anthropics/claude-code/issues/6686) may be
reopened or rendered moot by improved adapter quality.

* * *

## Relationship to Other Research Docs

### Scope Boundaries

These three Claude Code research docs cover complementary aspects:

| Doc | Focus | Key Question |
| --- | --- | --- |
| **This doc** (Orchestration & UIs) | External control interfaces and UI surfaces | *Through what interfaces can you control Claude Code?* |
| **[Sub-Agents](research-claude-code-sub-agents.md)** | Internal agent architecture | *How does Claude Code delegate work to sub-agents internally?* |
| **[Running Across Environments](research-running-claude-code.md)** | Multi-agent ecosystem | *What frameworks exist for coordinating multiple coding agents?* |

**Intentional overlaps:**
- *Orchestrating instances from instances* (Section 3 of this doc) overlaps with the
  sub-agents doc's Section 7 (Ralph Wiggum Loops). The sub-agents doc goes deeper on
  patterns and compaction; this doc focuses on the protocol/interface mechanics.
- *Third-party projects* appear in both this doc and the running-across-environments doc.
  This doc covers them as UI surfaces; the other doc covers them as orchestration frameworks.
- *ACP* appears in this doc (as a control protocol) and the bridge integrations doc (as a
  multi-agent protocol). This doc goes deeper on Claude Code's specific relationship with ACP.

### Suggested Revisions to Other Docs

After reviewing all related research docs, here are observations on scope consistency:

1. **`research-running-claude-code.md` Part 7 and Part 8:**
   These sections (Claude Code's native multi-agent features, IDE/platform integrations)
   overlap with this doc's scope. The running-across-environments doc should reference this
   doc for detailed protocol analysis and keep its coverage at the ecosystem survey level.
   No content removal needed — the overlap is complementary rather than redundant.

2. **`research-claude-code-sub-agents.md` Section 7:**
   The "Ralph Wiggum Loops" section covers `claude -p` orchestration in depth. This doc's
   Section 3 (Pattern 1) should reference it for patterns/compaction details rather than
   duplicating them.

3. **`api-references-bridge-integrations.md` Section 4.1:**
   The multi-agent protocols section (MCP, ACP, A2A, ANP) is a reference doc, not analysis.
   This doc adds the analytical layer on ACP specifically as it relates to Claude Code. No
   revision needed — the scopes are complementary.

* * *

## Recommendations

### For Individual Developers

**If you use VS Code or JetBrains:** The official extensions provide the best integrated
experience. Use `&` prefix for cloud dispatch when you want parallel execution.

**If you use Neovim:** [coder/claudecode.nvim](https://github.com/coder/claudecode.nvim)
provides full IDE integration protocol support.

**If you use Zed:** ACP adapter
([`@zed-industries/claude-code-acp`](https://github.com/zed-industries/claude-code-acp))
works but with limitations.

**If you want maximum control:** Terminal CLI with `claude -p` scripting is the most powerful
and portable option.

### For Orchestration / Multi-Agent Use Cases

**Simplest (Max plan):** Script `claude --remote` with issue bodies piped in. Cloud
execution, zero infrastructure.

**Most control (subscription):** Build a WebSocket server using the `--sdk-url` protocol.
The [Companion project](https://github.com/The-Vibe-Company/companion)'s
WEBSOCKET_PROTOCOL_REVERSED.md is the best reference. Gives full session lifecycle control
while using Claude Code CLI as the execution engine.

**Most control (API key):** Use the Claude Agent SDK (TypeScript or Python) for production
systems. Official support, clean APIs, structured output.

**Most portable:** Use the ACP adapter if you want cross-editor compatibility, but accept
current limitations.

**For sandbox deployment:** [Sandbox Agent](https://github.com/rivet-dev/sandbox-agent) by
Rivet provides a universal HTTP API that abstracts across agents.

### For Custom UI Builders

**Browser/mobile UI:** The `--sdk-url` protocol (see Companion project) provides the most
direct control without requiring API keys.

**Desktop app:** Tauri + Agent SDK (see OpCode, Claudia) provides native performance with
web technologies.

**TUI:** ACP + Textual (see Toad) for terminal-native universal agent UIs.

* * *

## March 2026 Updates

### Claude Code Platform Changes

Several changes since mid-February affect the orchestration landscape:

**New interaction paradigms:**
- **`/loop` command:** Run prompts on recurring intervals (e.g., `/loop 5m check the
  deploy`) with cron scheduling. Relevant for heartbeat-style monitoring without external
  orchestration.
- **Voice mode:** `/voice` toggle, STT now supports 20 languages. New input modality for
  session control.
- **`/simplify` and `/batch` commands:** New built-in slash commands.

**Agent SDK updates:**
- Rebranded from "Claude Code SDK" to **Claude Agent SDK**.
- v0.1.48 (March 7) fixed `include_partial_messages=True` regression (affected
  v0.1.36-0.1.47).
- New hook inputs: `agent_id` and `agent_type` fields added to tool-lifecycle hooks —
  useful for orchestrators tracking which agent triggered which action.
- Apple **Xcode 26.3** now integrates the Claude Agent SDK natively.

**Agent Teams bug fixes (March 2026):**
- Fixed `--print` hanging forever when agent teams configured.
- Fixed teammates accidentally spawning nested teammates via Agent tool's name parameter.
- Still no role-based model selection (community wants lead on Opus, workers on Sonnet).
- Still one team per session, no nested teams, no session resumption.

**API-level changes:**
- **Compaction API** (beta): Server-side context summarization for infinite conversations.
- **Tool Search** (public beta): Dynamic tool discovery from large catalogs.
- **Effort parameter** GA: Replaces `budget_tokens` on new models.
- **Sonnet 4.6** launched; Opus 4/4.1 deprecated from model selector.

### Ecosystem Rebrands and Security Events

**OpenClaw (formerly Moltbot/Clawdbot):** Now at 100k+ GitHub stars. Renamed from Moltbot
on Jan 30, 2026 after Anthropic trademark complaints. Creator Peter Steinberger joining
OpenAI (Feb 14). Major security vulnerabilities discovered: "ClawJacked" — full agent
takeover via any website. Microsoft warns it should NOT run on standard workstations.
Relevant because Paperclip uses OpenClaw as its primary adapter target.

**Ruflo (formerly Claude Flow):** Rebranded Feb 27, 2026 with v3.5 as "first major stable
release." ~19.9k stars, 215 MCP tools, 60+ agents. WASM kernels in Rust for policy
engine.

**OpCode:** Now at 20.8k stars. Same Asterisk Labs (YC-backed) team.

**Gas Town:** Now has a companion web GUI
([gastown-gui](https://github.com/web3dev1337/gastown-gui)). Real-world cost reports:
~$100/hour in Claude tokens. Steve Yegge reportedly runs three concurrent Claude Max
accounts.

### New UI/Orchestration Projects

| Project | Stars | Key Differentiator |
| --- | --- | --- |
| [cmux (Manaflow)](https://github.com/manaflow-ai/cmux) | 4.2k | Native macOS terminal app for AI agents (YC-backed) |
| [Symphony (OpenAI)](https://github.com/openai/symphony) | NEW | Issue-tracker-driven daemon orchestrator with per-issue workspaces |
| [Claude Squad](https://github.com/smtg-ai/claude-squad) | 5.8k+ | tmux TUI for multi-agent worktree sessions |
| [CodePilot](https://github.com/op7418/CodePilot) | — | Electron desktop, mobile bridges (Telegram/Discord/QQ/Feishu) |
| [myclaude](https://github.com/stellarlinkco/myclaude) | 2.4k | Multi-runtime orchestration (Claude, Codex, Gemini, OpenCode) |
| [Multiclaude](https://github.com/dlorenc/multiclaude) | — | "Brownian ratchet" — CI as one-way gate, auto-merge passing PRs |
| [cmux (craigsc)](https://github.com/craigsc/cmux) | ~276 | Git worktree lifecycle manager for Claude Code |
| [amux](https://github.com/mixpeek/amux) | — | tmux-based multiplexer + web dashboard for headless agents |
| [coder/mux](https://github.com/coder/mux) | — | Desktop app with custom agent loop (Plan/Exec, vim inputs) |
| [CloudCLI](https://github.com/siteboon/claudecodeui) | — | Web UI for remote/mobile Claude Code session management |
| [Zerg](https://github.com/) | — | Parallel orchestration with security and crash recovery |
| [Agentrooms](https://claudecode.run/) | — | @mention-based multi-agent coordination, local + remote |

### cmux (Manaflow) — Native macOS Terminal for AI Agents (NEW)

**Repository:** [manaflow-ai/cmux](https://github.com/manaflow-ai/cmux)
**Website:** [cmux.dev](https://www.cmux.dev/)
**Stars:** ~4,200 (0 → 3,500 in two weeks)
**License:** AGPL-3.0-or-later
**Backed by:** Y Combinator (via Manaflow)

cmux is a **native macOS terminal application** purpose-built for running and managing
multiple AI coding agents simultaneously. It is NOT a tmux wrapper — it is an entirely
independent terminal emulator written in Swift/AppKit, using **libghostty** (from the
Ghostty terminal project) for GPU-accelerated rendering. Mitchell Hashimoto (creator of
Ghostty, founder of HashiCorp) has publicly endorsed it.

**Architecture:**
- Native macOS app (Swift + AppKit), not Electron
- GPU-accelerated terminal rendering via libghostty
- Reads existing `~/.config/ghostty/config` for themes, fonts, colors
- Socket API + CLI for scripting
- Auto-updates via Sparkle framework

**Key features:**
- **Vertical tab sidebar:** Shows git branch, linked PR status/number, working directory,
  listening ports, and latest notification text per workspace
- **Notification system:** Blue rings around panes needing attention, unread badges in
  sidebar, macOS desktop notifications. Fires via standard terminal escape sequences
  (OSC 9/99/777) or via `cmux notify` CLI wired into Claude Code hooks
- **Built-in scriptable browser:** In-app browser with API for agents to snapshot
  accessibility trees, get element refs, click, fill forms, evaluate JS. Split browser
  pane next to a terminal pane and have Claude Code interact with dev server directly
- **Full scriptability:** CLI and socket API to create workspaces/tabs, split panes, send
  keystrokes, open URLs
- **Multi-agent orchestration:** A primary agent can send instructions to sub-agents,
  monitor progress, and gather results within a single cmux workspace. The `send` command
  types text into a specified pane; `send-key` simulates keypresses to launch independent
  agent instances

**Philosophy:** "A primitive, not a solution." Provides composable building blocks
(terminal, browser, notifications, workspaces, splits, tabs, CLI) and lets developers
find efficient workflows themselves.

**Install:** `brew tap manaflow-ai/cmux && brew install --cask cmux`

**Note:** macOS only — no Linux or Windows support currently.

There is also a separate, unrelated project **[craigsc/cmux](https://github.com/craigsc/cmux)**
(~276 stars) which is a lightweight CLI worktree lifecycle manager for Claude Code. It
manages git worktrees (`cmux new <branch>`, `cmux start`, `cmux ls`, `cmux merge`,
`cmux rm`) but is NOT a terminal app. Claude Code's built-in `--worktree` (`-w`) flag
now overlaps with its core function.

### OpenAI Symphony — Issue-Tracker-Driven Agent Orchestrator (NEW)

**Repository:** [openai/symphony](https://github.com/openai/symphony)
**Status:** Engineering preview (low-key, trusted environments)
**Spec:** Language-agnostic; reference implementation in Elixir/OTP

Symphony is a **long-running daemon service** that continuously reads work from an issue
tracker (currently Linear), creates an isolated workspace for each issue, and runs a
coding agent (currently Codex in app-server mode) inside the workspace. It is
architecturally the most spec-driven orchestrator in this space — the core behavior is
defined in a detailed [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
(~4,000 words) that any language can implement.

**What it solves:**
1. Turns issue execution into a repeatable daemon workflow (not manual scripts)
2. Isolates agent execution in per-issue workspaces
3. Keeps workflow policy in-repo (`WORKFLOW.md`) so teams version the agent prompt and
   runtime settings with their code
4. Provides observability to operate and debug multiple concurrent agent runs

**Core architecture (6 layers):**
1. **Policy Layer:** `WORKFLOW.md` prompt body + team-specific rules
2. **Configuration Layer:** YAML front matter → typed getters with defaults and `$VAR`
   expansion
3. **Coordination Layer:** Orchestrator — polling loop, issue eligibility, concurrency
   control, retries, reconciliation
4. **Execution Layer:** Workspace lifecycle + coding-agent subprocess management
5. **Integration Layer:** Linear adapter (GraphQL API, issue normalization)
6. **Observability Layer:** Structured logs + optional Phoenix LiveView dashboard

**Key design decisions:**
- **Codex app-server protocol:** Speaks JSON-RPC 2.0 over stdio with `initialize` →
  `initialized` → `thread/start` → `turn/start` handshake. Handles `turn/completed`,
  `turn/failed`, `turn/cancelled`, approval requests, and tool calls.
- **Multi-turn within a worker:** After each turn completes, the worker re-checks issue
  state on the tracker. If still active, starts another turn on the same thread (up to
  `agent.max_turns`, default 20). Continuation turns get short guidance, not the full
  prompt.
- **Continuation retries:** After a clean worker exit, the orchestrator schedules a 1s
  retry to re-check if the issue is still active.
- **Failure retries:** Exponential backoff: `min(10000 * 2^(attempt-1), max_retry_backoff_ms)`.
- **Stall detection:** If no Codex event received within `stall_timeout_ms` (default 5
  min), kill worker and retry.
- **Workspace persistence:** Workspaces reuse across runs (no auto-delete on success).
  Terminal issues trigger workspace cleanup.
- **Dynamic config reload:** Watches `WORKFLOW.md` for changes and re-applies without
  restart.
- **No persistent database:** Recovery is tracker-driven + filesystem-driven.

**Elixir/OTP reference implementation:**
- GenServer orchestrator with OTP supervision
- Erlang Port for Codex subprocess management
- Phoenix LiveView dashboard at `/` with JSON API at `/api/v1/*`
- `linear_graphql` dynamic tool injected into Codex sessions (so the agent can make
  arbitrary Linear GraphQL calls)
- Handles approval auto-approval, tool call dispatch, input-required signals
- Fully hot-reloadable without stopping running agents

**WORKFLOW.md contract:** The entire workflow — polling config, workspace setup, hooks,
agent settings, and prompt template with Liquid-style `{{ issue.identifier }}` variables —
lives in one version-controlled Markdown file. This is a powerful pattern: the prompt IS
the configuration.

**Relevance to Claude Code:** Symphony is designed for Codex, but the app-server protocol
is agent-agnostic. The `codex.command` config field accepts any shell command that speaks
JSON-RPC over stdio, making it theoretically possible to swap in a Claude Code adapter.
The architectural patterns (per-issue workspaces, multi-turn continuation, WORKFLOW.md
prompt-as-config, stall detection, reconciliation loops) are directly applicable to
Claude Code orchestration design.

### Multiclaude — "Brownian Ratchet" Multi-Agent Orchestrator (Expanded)

**Repository:** [dlorenc/multiclaude](https://github.com/dlorenc/multiclaude)
**Author:** Dan Lorenc (Chainguard CEO, co-creator of Sigstore)
**Language:** Go (99.5%)
**License:** MIT
**Stars:** ~250–500
**Released:** January 2026
**Blog:** [A Gentle Introduction to multiclaude](https://dlorenc.medium.com/a-gentle-introduction-to-multiclaude-36491514ba89)

Multiclaude spawns multiple autonomous Claude Code agents in tmux windows, each with its
own git worktree, working concurrently on a shared codebase. The project is self-hosting —
multiclaude's own agents wrote its code.

**The "Brownian ratchet" philosophy:** Borrowed from physics — random molecular motion
converted to directional progress via a one-way mechanism. Applied to software: multiple
agents make random attempts, CI acts as the ratchet (passing PRs merge, failing ones are
discarded), and progress is permanent. Perfect coordination is explicitly rejected:
*"Trying to perfectly coordinate agent work is both expensive and fragile. Instead, we let
chaos happen and use CI as the ratchet that captures forward progress."* The motto: *"Three
okay PRs beat one perfect PR."*

**Agent roles:**

| Agent | Role |
| --- | --- |
| **Supervisor** | Air traffic control. Watches workers, detects stuck agents, sends nudges |
| **Merge Queue** | Watches PRs. Green CI = merge. Red CI = spawn fix-it worker |
| **Workers** | Given a task, execute it, create PR, self-destruct. Each gets a cute animal name |
| **PR Shepherd** | (Multiplayer mode) Coordinates human reviewers for team workflows |
| **Reviewer** | Provides automated code review feedback on PRs |
| **Workspace** | Personal Claude interface for the human operator |

**Two modes:** Single Player (auto-merge all passing PRs, max velocity) and Multiplayer
(PR Shepherd coordinates human reviewers).

**Architecture — "refreshingly dumb":**
- No fancy orchestration framework. No distributed consensus. Just files, tmux, and Go.
- A daemon runs **four loops**, each ticking ~every 2 minutes:
  1. **Health check** — are agents alive? Try resurrection, then clean up
  2. **Message passing** — agents communicate via JSON files on disk; daemon types
     messages into recipient tmux windows
  3. **Wake/nudge cycle** — periodic prods to keep agents moving
  4. **Worktree refresh** — keeps git worktrees in sync
- State lives in a JSON file + filesystem. No database. Survives session crashes.
- Public libraries: `pkg/tmux` (programmatic tmux control), `pkg/claude` (Claude Code
  interaction)

**Custom agents:** Defined as markdown files in `.multiclaude/agents/` (per-repo,
shareable) or `~/.multiclaude/repos/<repo>/agents/` (per-user). No code needed — just
write a markdown file describing the role.

**Install:** `go install github.com/dlorenc/multiclaude/cmd/multiclaude@latest`

**Usage:**
```bash
multiclaude start
multiclaude repo init https://github.com/your/repo
multiclaude worker create "your task description"
```

**Other "multi-claude" projects (disambiguation):**
- **[abrookins/multi-claude](https://github.com/abrookins/multi-claude)** (~6 stars) —
  Python script for isolated workspaces per feature, LLM-based approval workflows,
  `TASK_MEMORY.md` persistence. Lighter-weight.
- **[0xDaz/MultiClaude](https://github.com/0xDaz/MultiClaude)** (~1 star, alpha) —
  Electron + React desktop app for running multiple Claude Code instances in tabs.
  Not an orchestrator — just a multi-tab manager.
- **[pbantolas/multiclaude](https://github.com/pbantolas/multiclaude)** — Version manager
  for switching between Claude Code versions (different purpose entirely).

See also: [The Brownian Ratchet and the Chimpanzee Factory](https://dev.to/aronchick/the-brownian-ratchet-and-the-chimpanzee-factory-583n)
comparing multiclaude and GasTown architectures.

### Industry Context (March 2026)

- Claude Code now authors **4% of public GitHub commits**, projected 20% by end of 2026.
- Claude Code skills ecosystem: grew from ~50 (mid-2025) to **334+**.
- Anthropic's C compiler project: 16 agents, ~2,000 sessions, $20k API costs, produced
  100k-line Rust C compiler that builds Linux 6.9 on x86/ARM/RISC-V.
- **Claude Marketplace** launched — enterprises can apply Anthropic spend commitments
  toward third-party Claude-powered tools (GitLab, Replit, Harvey, Lovable, Snowflake).
- Claude Code added to every Team plan standard seat.

* * *

## Next Steps

- [ ] Test `--sdk-url` protocol with a minimal WebSocket server to validate Companion's
  documentation
- [ ] Evaluate ACP adapter stability for Zed integration (install and test
  `@zed-industries/claude-code-acp`)
- [ ] Prototype a minimal orchestrator using `claude --remote` for tbd issue dispatch
- [ ] Monitor Anthropic's stance on ACP — watch for any reopening of issue #6686
- [ ] Track Agent SDK V2 preview for session management improvements
- [ ] Evaluate Sandbox Agent for multi-agent sandbox orchestration
- [ ] Test Companion for browser-based session management
- [ ] Deploy Paperclip locally and test Claude Code adapter integration
- [ ] Evaluate `/loop` command as lightweight alternative to external heartbeat orchestration
- [ ] Monitor OpenClaw security situation — assess impact on Paperclip adapter usage
- [ ] Track Ruflo v3.5 stability for potential use as orchestration layer
- [ ] Evaluate Anthropic ToS impact on `--sdk-url` wrapper projects

* * *

## References

### Official Anthropic Documentation

- [Claude Code on the Web](https://code.claude.com/docs/en/claude-code-on-the-web) — Cloud
  execution and `--remote` flag
- [Set up Claude Code](https://code.claude.com/docs/en/setup) — Authentication including
  `setup-token`
- [Use Claude Code in VS Code](https://code.claude.com/docs/en/vs-code) — Official VS Code
  extension
- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) — Agent SDK
  and `claude -p` usage
- [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — Python and
  TypeScript SDK
- [CLI reference](https://code.claude.com/docs/en/cli-reference) — Complete CLI flag
  reference

### WebSocket Protocols

- [The-Vibe-Company/companion](https://github.com/The-Vibe-Company/companion) —
  WEBSOCKET_PROTOCOL_REVERSED.md, the definitive `--sdk-url` protocol reference
- [CVE-2025-52882](https://securitylabs.datadoghq.com/articles/claude-mcp-cve-2025-52882/)
  — IDE integration protocol authentication vulnerability
- [coder/claudecode.nvim](https://github.com/coder/claudecode.nvim) — Neovim
  reimplementation of IDE integration protocol with PROTOCOL.md

### ACP (Agent Client Protocol)

- [Zed — Agent Client Protocol](https://zed.dev/acp) — ACP specification and overview
- [zed-industries/claude-code-acp](https://github.com/zed-industries/claude-code-acp) —
  Official ACP adapter for Claude Code
- [Issue #6686](https://github.com/anthropics/claude-code/issues/6686) — Anthropic declining
  native ACP support
- [Claude Code: Now in Beta in Zed](https://zed.dev/blog/claude-code-via-acp) — Zed blog
  on Claude Code ACP integration
- [ACP Brings JetBrains on Board](https://zed.dev/blog/jetbrains-on-acp) — JetBrains
  co-developing ACP
- [How the Community is Driving ACP Forward](https://zed.dev/blog/acp-progress-report) —
  ACP ecosystem progress report

### Third-Party Projects

- [manaflow-ai/cmux](https://github.com/manaflow-ai/cmux) — Native macOS terminal app for
  AI agents (YC-backed, libghostty-based)
- [openai/symphony](https://github.com/openai/symphony) — Issue-tracker-driven daemon
  orchestrator with per-issue workspaces and Codex app-server protocol
- [craigsc/cmux](https://github.com/craigsc/cmux) — Git worktree lifecycle manager for
  Claude Code
- [mixpeek/amux](https://github.com/mixpeek/amux) — tmux-based multiplexer + web dashboard
  for headless agent sessions
- [coder/mux](https://github.com/coder/mux) — Desktop app with custom agent loop
  (Plan/Exec, vim inputs)
- [paperclipai/paperclip](https://github.com/paperclipai/paperclip) — Company-level control
  plane for autonomous AI organizations
- [winfunc/opcode](https://github.com/winfunc/opcode) — OpCode Tauri desktop command center
- [marcusbey/claudia](https://github.com/marcusbey/claudia) — Claudia (YC-backed) desktop
  GUI
- [andrepimenta/claude-code-chat](https://github.com/andrepimenta/claude-code-chat) — Claude
  Code Chat VS Code extension
- [Haleclipse/Claudix](https://github.com/Haleclipse/Claudix) — Claudix Vue 3 VS Code
  extension
- [rivet-dev/sandbox-agent](https://github.com/rivet-dev/sandbox-agent) — Universal HTTP API
  adapter
- [dzhng/claude-agent-server](https://github.com/dzhng/claude-agent-server) — WebSocket
  server wrapping Agent SDK
- [Toad](https://willmcgugan.github.io/toad-released/) — Unified TUI for ACP-enabled agents
- [op7418/CodePilot](https://github.com/op7418/CodePilot) — Electron desktop GUI with mobile
  bridges
- [smtg-ai/claude-squad](https://github.com/smtg-ai/claude-squad) — tmux TUI for
  multi-agent sessions
- [stellarlinkco/myclaude](https://github.com/stellarlinkco/myclaude) — Multi-runtime
  orchestration
- [dlorenc/multiclaude](https://github.com/dlorenc/multiclaude) — "Brownian ratchet"
  auto-merge orchestrator (Go, tmux, git worktrees)
- [A Gentle Introduction to multiclaude](https://dlorenc.medium.com/a-gentle-introduction-to-multiclaude-36491514ba89) —
  Dan Lorenc, Jan 2026
- [The Brownian Ratchet and the Chimpanzee Factory](https://dev.to/aronchick/the-brownian-ratchet-and-the-chimpanzee-factory-583n) —
  multiclaude vs GasTown comparison
- [abrookins/multi-claude](https://github.com/abrookins/multi-claude) — Python multi-workspace
  agent manager with LLM approval workflows
- [0xDaz/MultiClaude](https://github.com/0xDaz/MultiClaude) — Electron multi-tab Claude Code
  manager (alpha)
- [ruvnet/ruflo](https://github.com/ruvnet/ruflo) — Ruflo (formerly Claude Flow), 19.9k
  stars

### Other References

- [Advanced Claude Code: Remote Sessions](https://erikbethke.com/blog/advanced-claude-code)
  — Remote session patterns
- [Claude Code CLI: The Definitive Technical Reference](https://blakecrosley.com/en/guides/claude-code)
  — Comprehensive CLI reference
- [Issue #8938](https://github.com/anthropics/claude-code/issues/8938) — `setup-token` not
  sufficient for fresh containers
- [Google, Zed fight VS Code lock-in with ACP](https://www.theregister.com/2025/08/28/google_zed_acp/)
  — Industry analysis of ACP
