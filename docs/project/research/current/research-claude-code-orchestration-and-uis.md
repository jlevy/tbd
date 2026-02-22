# Research: Claude Code Orchestration Interfaces and UIs

**Date:** 2026-02-15 (last updated 2026-02-15)

**Author:** Research brief (AI-assisted)

**Status:** In Progress

**Related:**

- [Running Claude Code Across Environments](research-running-claude-code.md) — Multi-agent
  orchestration ecosystem survey (orchestration frameworks, execution environments,
  inter-agent communication)
- [Claude Code Sub-Agents](research-claude-code-sub-agents.md) — Internal sub-agent
  architecture, model configuration, compaction/handoff patterns
- [API References for Bridge Integrations](../api-references-bridge-integrations.md) —
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
| [OpCode](https://github.com/winfunc/opcode) | Tauri desktop app | Agent SDK / process | Custom AI agents, session versioning, checkpoint viz |
| [Claudia](https://github.com/marcusbey/claudia) (Asterisk, YC) | Tauri desktop app | CLI wrapper | Session time travel, sandboxed background agents |
| [Claude Code Chat](https://github.com/andrepimenta/claude-code-chat) | VS Code extension | CLI wrapper | Chat panel interface, WSL support |
| [Claudix](https://github.com/Haleclipse/Claudix) | VS Code extension (Vue 3) | Agent SDK | Shares data with local Claude Code, DI architecture |
| [Companion](https://github.com/The-Vibe-Company/companion) | Browser/mobile UI | `--sdk-url` WebSocket | Full session control from browser, no extra API key |
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

### Other References

- [Advanced Claude Code: Remote Sessions](https://erikbethke.com/blog/advanced-claude-code)
  — Remote session patterns
- [Claude Code CLI: The Definitive Technical Reference](https://blakecrosley.com/en/guides/claude-code)
  — Comprehensive CLI reference
- [Issue #8938](https://github.com/anthropics/claude-code/issues/8938) — `setup-token` not
  sufficient for fresh containers
- [Google, Zed fight VS Code lock-in with ACP](https://www.theregister.com/2025/08/28/google_zed_acp/)
  — Industry analysis of ACP
