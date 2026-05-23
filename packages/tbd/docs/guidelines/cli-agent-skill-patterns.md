---
title: Agent Skills & CLI Integration Patterns
description: How to write skills and agent-integrated CLIs that work across Claude Code, Codex, and the broader coding-agent ecosystem — a simple baseline plus references for advanced, multi-subcommand tools
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Agent Skills & CLI Integration Patterns

**Last Updated**: 2026-05-23 (research verified against primary sources May 2026)

This guideline covers how to package a capability so AI coding agents can discover and
use it well — from a single-file skill up to a full CLI with many subcommands exposed as
a skill. It is deliberately **not dogmatic**: most needs are met by a tiny `SKILL.md`,
and the heavier patterns are opt-in for tools that genuinely need them.

The patterns draw on the current (May 2026) state of the ecosystem and on `tbd`’s own
implementation, which serves as a reference for the advanced “CLI-as-skill” approach.

**When to use this guideline**: when building or packaging anything an AI coding agent
should use — a prompt-only skill, a CLI tool, an MCP server, or a multi-agent
integration — and you want it to work across Claude Code, Codex, Cursor, Gemini CLI, and
others without rewriting it per agent.

> **The single most important shift since 2025**: skills and project instructions are
> now **open standards**, not per-vendor formats.
> `AGENTS.md` and the Agent Skills (`SKILL.md`) format are both governed under the Linux
> Foundation’s **Agentic AI Foundation (AAIF)**, and are read by 20–60+ tools.
> Write to the standard once; most agents pick it up for free.

* * *

## 0. Start Here — The Simple Baseline

Read this section first.
For the large majority of cases, you are done after it.

### 0.1 If you just want a skill (prompt-only capability)

Create one folder with one file:

```
my-skill/
└── SKILL.md
```

```markdown
---
name: my-skill
description: >-
  Analyze Excel spreadsheets, build pivot tables, and export results.
  Use when the user mentions .xlsx files, tabular data, or spreadsheets.
---
# My Skill

Step-by-step instructions the agent should follow...
```

That is the entire artifact — no build step, no runtime, no dependencies.
This is the **Agent Skills open standard** ([agentskills.io](https://agentskills.io)),
and the same folder works in Claude Code, Codex CLI, Gemini CLI, GitHub Copilot, Cursor,
Windsurf, Cline, pi, and 20+ other tools.
Garry Tan’s **gstack** (~97K stars) is 23 skills, each a plain `SKILL.md` and nothing
more — proof the baseline scales without custom tooling.

**The only two things that matter for a basic skill:**

1. A **`description`** that says *what it does* AND *when to use it* (this drives
   activation — see §4.2).
2. A **body under ~500 lines** of clear, imperative instructions.

**Install it** by copying into a known directory, or with the cross-agent package
manager:

```bash
npx skills add owner/repo       # Vercel's skills.sh ecosystem (symlinks, 27+ agents)
# or just commit it to .claude/skills/my-skill/SKILL.md (project)
# or ~/.claude/skills/my-skill/SKILL.md (personal)
```

### 0.2 If your capability is a CLI

Most agents already know how to run CLIs from their training data, and benchmarks show a
CLI is far cheaper and more reliable than an MCP server for tools that have one (§7).
So:

1. Make the CLI **agent-friendly**: a clear `--help`, a `--json` flag on every command,
   actionable errors, and idempotent, non-interactive operation (`--yes`/`--auto`).
2. Ship a **`SKILL.md`** (or an `AGENTS.md` snippet) that tells the agent the tool
   exists, what it’s for, and the handful of commands to run.
3. That’s the baseline.
   Stop here unless you have many subcommands or need cross-session state, structured
   auth, or background services — then see §6 (CLI-as-skill) and §7 (MCP).

### 0.3 The one-paragraph decision guide

- **Prompt/instructions only** → ship a `SKILL.md`. (§3, §4)
- **Project-wide conventions** (build/test/style) → add an `AGENTS.md`. (§2)
- **You have a CLI** → `SKILL.md` + agent-friendly `--json` CLI. (§0.2, §6)
- **Many subcommands / a knowledge library** → CLI-as-skill meta-pattern.
  (§6)
- **A service with no CLI, or you need OAuth / multi-tenant / audit** → MCP server.
  (§7)
- **Maximum reach across many agents** → layer them: AGENTS.md + SKILL.md + CLI + MCP.
  (§1)

Everything below is reference material.
You do not need most of it for most tools.

* * *

## 1. The Layered Model — “Write Once, Integrate Many”

There is no single integration surface that every agent uses, but the surfaces compose
cleanly.
Pick the lowest layer that satisfies your need; add higher layers only for reach
or capability.

| Layer | Artifact | What it’s for | Reach (May 2026) |
| --- | --- | --- | --- |
| 1. Project baseline | `AGENTS.md` | Build/test/style/conventions for *this repo* | Codex, Cursor, Copilot, Gemini CLI, Windsurf, Amp, Jules, Goose, Factory, Aider, opencode, pi |
| 2. Portable capability | `SKILL.md` (Agent Skills) | A reusable, on-demand capability | Claude Code, Codex, Gemini CLI, Copilot (VS Code), Cursor, Windsurf, Cline, pi, 20+ |
| 3. Execution | A CLI | Efficient, composable tool the agent invokes via shell | Every agent with a shell tool |
| 4. Structured/remote | MCP server | Services without a CLI; OAuth, multi-tenant, audit | Every major agent except Aider (native); pi via extension |
| 5. Per-agent polish | `.cursor/rules/*.mdc`, plugin packaging, ACP, etc. | Glob-scoped activation, enterprise distribution, editor discovery | Per-agent |

**Recommended default for a tool author who wants broad reach**: ship an `AGENTS.md`
snippet (universal baseline) + a `SKILL.md` (portable capability) + an agent-friendly
CLI. Add an MCP server only when a CLI can’t serve the need.
Add agent-specific files last, and only where they buy something.

* * *

## 2. AGENTS.md — The Universal Project Baseline

`AGENTS.md` is a plain-Markdown file at the repo root that tells any agent how your
project works: build commands, test commands, conventions, gotchas.
It is **not** capability-specific — think of it as the README written for agents.

**Governance & reach**: Originated by OpenAI (Aug 2025); since Dec 2025 stewarded by the
**Agentic AI Foundation under the Linux Foundation** (co-founded by OpenAI, Anthropic,
and Block; ~180 member orgs).
Used by **60,000+** open-source projects.
Canonical spec: [agents.md](https://agents.md).

**Discovery & precedence** vary by agent — know your targets:

- **Codex**: reads global `~/.codex/AGENTS.md` (or `AGENTS.override.md`), then walks
  from repo root down to the working directory, concatenating one file per directory
  (root→leaf, deeper overrides shallower).
  Combined content is capped at `project_doc_max_bytes` (**default 32 KiB**). It does
  **not** lazy-load nested files when reading child directories (open request).
- **Cursor** (since v1.6), **Copilot** (since Aug 2025), **Windsurf**, **Gemini CLI**
  (alongside `GEMINI.md`), **Amp** (falls back to `CLAUDE.md`), **Jules**, **Goose**
  (hierarchical scoping), **Factory**, **opencode**, **pi**: all read `AGENTS.md`
  natively.
- **Claude Code**: as of May 2026 does **not** auto-load `AGENTS.md`; it uses
  `CLAUDE.md`. A common pattern is to symlink `CLAUDE.md → AGENTS.md`, or to maintain
  both. (`tbd` writes a marked section into `AGENTS.md` and lets users keep a separate
  `CLAUDE.md`.)
- **Aider**: uses `CONVENTIONS.md` but recommends `AGENTS.md` for interoperability.

**Author tip**: keep `AGENTS.md` concise (it loads into every turn and competes for
context).
Put deep, on-demand material in skills or files the agent can open when needed.
`AGENTS.override.md` lets a developer override the committed file locally without
editing it.

* * *

## 3. The Agent Skills Standard (SKILL.md)

**What it is**: a folder with a `SKILL.md` file (YAML frontmatter + Markdown body), plus
optional supporting files.
Created by Anthropic (Dec 2025), published under Apache 2.0 at
[agentskills.io](https://agentskills.io).
280,000+ public skills exist as of early 2026.

**Standard frontmatter** (portable across agents): `name`, `description`. Optional but
widely recognized: `license`, `compatibility`, `metadata`, `allowed-tools`. Agents
silently ignore frontmatter keys they don’t understand, which is what makes a single
`SKILL.md` portable.

### 3.1 Progressive disclosure (the core design principle)

Skills are loaded in three levels so they cost almost nothing until used:

| Level | Content | Loaded | Budget |
| --- | --- | --- | --- |
| 1. Discovery | `name` + `description` only | Always (in the skill listing) | ~100 tokens |
| 2. Activation | Full `SKILL.md` body | When invoked (by user or model) | keep < ~5,000 tokens / 500 lines |
| 3. Execution | Supporting files, scripts, references | On demand, by the model reading the filesystem | unbounded |

**Constraints that matter**: keep the body **under 500 lines**; keep reference files
**one level deep** from `SKILL.md` (avoid `SKILL.md → a.md → b.md` chains); put bulky
material (schemas, examples, scripts) in supporting files.
Scripts execute *outside* the context window — only their output costs tokens, which is
why bundling a script can be far cheaper than inlining instructions.

### 3.2 Bundled scripts and resources

A skill folder can ship executable helpers:

```
my-skill/
├── SKILL.md
├── reference.md          # loaded only when the body points to it
├── scripts/
│   └── transform.py      # run by the agent; only stdout enters context
└── assets/
    └── template.xlsx
```

In Claude Code, `${CLAUDE_SKILL_DIR}` resolves to the skill’s directory for portable
script references. Anthropic’s own document skills (docx/pdf/pptx/xlsx) and the
`skill-creator` skill are good worked examples of this layout.

* * *

## 4. Writing a Great SKILL.md

### 4.1 Frontmatter: standard vs. Claude Code extensions

Only `name` and `description` are required by the open standard.
Claude Code recognizes a larger set (other agents ignore the extras):

| Field | Standard? | Notes |
| --- | --- | --- |
| `name` | ✓ | ≤ 64 chars; lowercase, digits, hyphens; defaults to directory name |
| `description` | ✓ | ≤ 1,024 chars in the field; see §4.2 |
| `license`, `compatibility`, `metadata` | ✓ (optional) | Portability/metadata |
| `allowed-tools` | ✓ (optional) | Pre-grant tools, e.g. `Bash(mycli:*), Read, Write` |
| `when_to_use` | Claude Code | Appended to `description` in the listing (shares the cap) |
| `argument-hint`, `arguments` | Claude Code | Autocomplete + `$name`/`$ARGUMENTS` substitution |
| `disable-model-invocation` | Claude Code | Skill won’t auto-trigger; user/explicit only |
| `user-invocable` | Claude Code | `false` = background knowledge, hidden from `/` menu |
| `model`, `effort` | Claude Code | Override model / reasoning effort for the skill’s turn |
| `context: fork`, `agent` | Claude Code | Run the skill in an isolated subagent |
| `paths` | Claude Code | Glob patterns that gate auto-activation to matching files |
| `hooks`, `shell` | Claude Code | Skill-scoped lifecycle hooks; `bash`/`powershell` |

Keep your committed `SKILL.md` to the **standard fields plus `allowed-tools`** if you
want maximum portability; add Claude-specific fields when you’re targeting Claude Code
specifically.

### 4.2 Description optimization (this is what makes skills activate)

Activation is **pure LLM reasoning** — the model reads every installed skill’s `name` +
`description` and decides what to invoke.
There is no keyword matcher or embedding step.
So the description is the single highest-leverage thing you write.

**The two-part rule** — every description answers:

1. **What does it do?** (capabilities)
2. **When should it be used?** (explicit triggers, in the user’s words)

```yaml
# Anti-pattern
description: Helps with documents

# Preferred
description: >-
  Analyze Excel spreadsheets, create pivot tables, and export data.
  Use when analyzing .xlsx files, working with tabular data, or when the
  user mentions spreadsheets or Excel.
```

**Writing rules**: third person ("Processes files," not “I can help you”); front-load
the most important trigger keywords in the first ~50 characters (descriptions can be
truncated in large collections); state both capability and trigger.

**Activation reliability** (community 650-trial sandboxed eval — directional, not
official): vague descriptions ~20% → optimized “Use when…” descriptions ~50% → adding
concrete examples ~72–90%. Two distinct failure modes to design against: *activation
failure* (never invoked) and *execution failure* (invoked but steps skipped — fix with
clearer, checklist-style instructions).

### 4.3 The description budget (changed in 2026 — verify against your target)

Earlier guidance cited a flat ~15K-character budget.
**Claude Code’s current model is different**:

- The skill listing gets a budget of **~1% of the model’s context window** by default
  (`skillListingBudgetFraction`, default `0.01`). When it overflows, the
  least-recently-invoked skills lose their descriptions first.
- Per-skill listing text (`description` + `when_to_use`) is truncated at **1,536 chars**
  (`maxSkillDescriptionChars`).
- `SLASH_COMMAND_TOOL_CHAR_BUDGET` overrides the fraction with a fixed character count.
- `skillOverrides` can set any skill to `on` / `name-only` / `user-invocable-only` /
  `off` without editing the file; `/doctor` reports overflow.

**Implication for tools that install many skills**: don’t. Use the **meta-skill
pattern** (§6.2) — one skill that exposes N resources via CLI subcommands consumes a
single listing slot instead of N. This is the strongest architectural reason to prefer
CLI-as-skill once you have more than a handful of capabilities.

* * *

## 5. Per-Agent Integration Reference

Targets differ.
This matrix reflects May 2026; verify against current docs for the agents
you care about.

| Agent | Project file | Skill / rules mechanism | MCP | Hooks | Best integration path |
| --- | --- | --- | --- | --- | --- |
| **Claude Code** | `CLAUDE.md` | Agent Skills (`SKILL.md`), `.claude/skills/`; plugins/marketplaces | Yes (stdio + Streamable HTTP) | 29 events | SKILL.md (+ plugin for distribution) |
| **Codex CLI** | `AGENTS.md` | `SKILL.md` skills + plugins (skills+MCP); `~/.codex/prompts` (deprecated) | Yes (stdio + Streamable HTTP) | — | AGENTS.md + skills/plugins + MCP |
| **Cursor** | `.cursor/rules/*.mdc`, `AGENTS.md` | MDC rules (Always/Auto-glob/Agent-requested/Manual) | Yes | 6 events (incl. `beforeShellExecution`) | AGENTS.md + `.mdc` for glob scoping |
| **GitHub Copilot** | `.github/copilot-instructions.md`, `AGENTS.md` | `SKILL.md` (VS Code); `.agent.md` custom agents | Yes | `preToolUse`/`postToolUse`/… | SKILL.md + MCP; enterprise-managed plugins |
| **Gemini CLI** | `GEMINI.md` + `AGENTS.md` | Agent Skills; extensions (bundle hooks) | Yes (stdio + SSE) | ~12 events | AGENTS.md + MCP/extension |
| **Windsurf** | `.windsurf/rules/*.md` + `AGENTS.md` | Rules with activation modes | Yes (OAuth, Streamable HTTP) | pre-hooks can **block** (exit 2) | AGENTS.md + MCP |
| **Cline** | `.clinerules/` | Glob-scoped rules; Cline SDK plugins | Yes (mature marketplace) | SDK lifecycle events | `.clinerules` + MCP |
| **Aider** | `CONVENTIONS.md` / `AGENTS.md` | Conventions file (read-only context) | No native (proxy only) | Git hooks only | AGENTS.md/CONVENTIONS.md |
| **opencode** | `AGENTS.md` + `opencode.jsonc` | JS/TS plugins; skills dir | Yes | 25+ events, tool interception | Plugin + MCP |
| **Amp** | `AGENTS.md` (→ `CLAUDE.md`) | Plugins (tools + hooks) | Yes (Sourcegraph MCP + custom) | session/turn/tool | MCP + plugin |
| **Jules** (Google) | `AGENTS.md` | AGENTS.md only | Yes (curated, since Feb 2026) | — (cloud async) | AGENTS.md + Jules REST API |
| **Goose** (Block) | `AGENTS.md` | Recipes; 70+ MCP extensions | Yes (deepest) | extension lifecycle | MCP (primary) |
| **Zed** | `.rules` (reads `.cursorrules`, `CLAUDE.md`) | Rules Library | Yes (extensions) | — | MCP extension + `.rules` |
| **Factory** | `AGENTS.md` + `.factory/droids/*.md` | Custom Droids (sub-agents) | Yes | Delegator loop | AGENTS.md + droid file |
| **pi** | `AGENTS.md` / `CLAUDE.md`, `.pi/SYSTEM.md` | Agent Skills (`.pi/skills/`, `.agents/skills/`); TS extensions | **No (by design)** — use CLI+README or an extension | extension hooks | SKILL.md + CLI; extension for deep tool registration |

**Notes on the minimal end (pi)**: pi (Mario Zechner’s `@mariozechner/pi-coding-agent`,
~44K stars) ships four tools (read/write/edit/bash) and treats context as a scarce
budget. It reads `AGENTS.md`/`CLAUDE.md`, supports the Agent Skills standard, and
**deliberately omits MCP** — its docs tell authors to “build CLI tools with READMEs” or
write a TypeScript extension (`pi.registerTool()` / `pi.registerCommand()`). This is a
clean endorsement of the CLI-as-skill approach: a self-documenting CLI plus a `SKILL.md`
is exactly what a minimal agent wants.

**Codex specifics** (it gained a real skill system in 2026): skills are `SKILL.md`
folders with the same progressive disclosure; they’re distributed via **plugins**
(installable units bundling skills + MCP servers — 90+ ship with Codex).
Operational config lives in `~/.codex/config.toml` (or trusted per-project
`.codex/config.toml`): `model`, `approval_policy`
(`untrusted`/`on-request`/`granular`/`never`), `sandbox_mode`
(`read-only`/`workspace-write`/`danger-full-access`), and `[mcp_servers.*]`. A CLI your
tool ships will run **inside Codex’s sandbox** — under `workspace-write`, writes are
limited to workspace roots and network is off unless explicitly enabled.
Design your CLI to work read-only where possible and to fail with a clear message when
sandboxed.

* * *

## 6. CLI-as-Skill (Advanced) — One Tool, Many Self-Injecting Commands

This is the pattern for a richer tool: a CLI that is itself a skill, exposing many
capabilities as subcommands while costing a single description slot.
`tbd` is the reference implementation; **Beads/`bd`** (Steve Yegge), `tbd`’s lineage,
follows the same shape (subcommands + `AGENTS.md` + `--json` + an optional MCP server).

Use this when you have many capabilities, need cross-session state, or want a curated
knowledge library the agent pulls from.
For a single capability, the §0 baseline is better — don’t reach for this prematurely.

### 6.1 Two kinds of commands

| Type | Purpose | Examples |
| --- | --- | --- |
| **Action commands** | Perform operations | `create`, `close`, `sync` |
| **Informational commands** | Output guidance for the agent to *follow* | `guidelines <name>`, `shortcut <name>`, `template <name>` |

Informational commands don’t *do* anything — they print instructions, best practices, or
templates the agent reads and acts on.
This is the mechanism behind tbd’s **knowledge-injection-via-subcommands**: rather than
installing dozens of skills, tbd installs *one* meta-skill and exposes its entire
library (`tbd guidelines --list`, `tbd guidelines typescript-rules`, …) as commands the
agent calls just-in-time.

This works well in practice and is the right answer for a many-subcommand CLI because:

- **Budget**: one listing slot, unbounded resources (vs.
  the per-skill budget in §4.3).
- **Currency**: resources ship and version with the CLI; `--list` is generated from
  what’s actually installed, so it never goes stale.
- **Composability**: each resource can reference other commands, forming a
  self-directing context loop (§6.4).

### 6.2 The meta-skill composition

tbd’s `skill` command composes the installed `SKILL.md` from parts so the static guide
and the dynamic catalog stay in sync:

```
┌─────────────────────────────────────┐
│ claude-header.md  (YAML frontmatter) │  ← name + two-part description + allowed-tools
├─────────────────────────────────────┤
│ skill-baseline.md (workflow guide)   │  ← the durable "how to use this tool" body
├─────────────────────────────────────┤
│ <!-- BEGIN SHORTCUT DIRECTORY -->    │  ← generated from the live DocCache
│   | command | title | description |  │
│ <!-- END SHORTCUT DIRECTORY -->      │
└─────────────────────────────────────┘
```

Maintain **two tiers** of skill content: a full `skill-baseline.md` (~2,000 tokens, the
default and the `skill` command) and a `skill-brief.md` (~400 tokens, for constrained or
post-compaction contexts).

### 6.3 Resource directories: show the full command

When listing resources, print the command to run, not just a name — it removes a step
for the agent.

```markdown
## Available Shortcuts
| Command | Purpose | Description |
|---------|---------|-------------|
| `mycli shortcut code-review` | Commit code | Pre-commit checks and commit flow |
| `mycli shortcut new-plan-spec` | Plan a feature | Create a planning specification |
```

Back resource lookup with a **path-ordered cache** so project- and user-level files can
shadow built-ins (like `$PATH`): project `.mycli/docs/` → user `~/.mycli/docs/` →
bundled. This lets teams customize without forking.

### 6.4 The context-injection loop

The payoff of informational commands is a self-reinforcing chain:

```
SKILL.md  ── "for TypeScript work, run `mycli guidelines typescript-rules`"
   └──▶ guideline ── "create issues with `mycli create`; for tests see `mycli guidelines testing`"
          └──▶ action commands / more guidelines, loaded just-in-time
```

Rules: reference commands **explicitly** (`mycli command arg`, never “see the docs”);
**limit chain depth to 3**; make every layer end in a concrete action.

### 6.5 Making the CLI agent-friendly

- **`--json` on every command** — one output path that renders human or machine output.
- **`--brief`/`--quiet`** for constrained contexts and scripts.
- **Idempotent `setup --auto`** (non-interactive) vs.
  `setup --interactive` for humans; never let an agent get stuck on a prompt.
- **Actionable errors** that include the next command to run.
- **Discoverable help**: an `IMPORTANT:` epilog pointing at a context-restore command
  (e.g., `mycli prime`), and a “Getting Started” one-liner.
- **A `prime` command** (dashboard + status + rules) for session start and post-compact,
  distinct from `skill` (pure documentation).

### 6.6 Distribution & multi-agent install

A CLI can install itself into multiple agents from one `setup` run.
tbd writes a CLI-managed `SKILL.md` to `.claude/skills/tbd/` and a **marker-bounded
section** into `AGENTS.md` (which now also feeds Cursor, Codex, and Factory), preserving
user content outside the markers:

```markdown
<!-- BEGIN MYCLI INTEGRATION -->
…CLI-generated…  ← owned by the CLI; regenerated on setup
<!-- END MYCLI INTEGRATION -->
```

**File-ownership rules**: version-control your *source* files (header, baseline, brief),
not the *installed* artifacts (`.claude/skills/**`, `AGENTS.md`). Mark generated skill
files “DO NOT EDIT.” Make setup idempotent: dedupe hooks before merging, overwrite
generated skills rather than patching them, and clean up legacy files each run.

* * *

## 7. CLI vs MCP vs Skill — Choosing the Surface

These are complementary, not competing.
Pick by need:

| Need | Surface |
| --- | --- |
| Prompt/instructions, portable | **SKILL.md** |
| Local processing, composable, you have/can build a CLI | **CLI** |
| Service with no CLI; OAuth, multi-tenant, audit, remote | **MCP server** |
| Both local convenience and structured/remote access | **CLI + MCP** |

**Why CLI usually wins when one exists**: benchmarks (2026) put a CLI at ~100% task
reliability and ~1.3K–8.7K tokens, vs.
MCP at ~72% reliability and ~32K–82K tokens — roughly **17× cheaper** at scale — because
LLMs already know common CLI usage and no tool schema is injected.
Use MCP when there’s no CLI to lean on or you need its auth/permission machinery.

**MCP current state (May 2026)**: governed by AAIF/Linux Foundation; two transports —
**stdio** (local) and **Streamable HTTP** (remote; replaced legacy SSE in the Nov 2025
spec, supports OAuth 2.1 + PKCE). Primitives: **tools**, **resources**, **prompts**.
Security is a real concern (a scan found 492 public servers with no auth) — authenticate
every request, scope every tool call, validate inputs, never pass tokens between
servers.

**Code execution with MCP** ("Code Mode"): instead of exposing many MCP tools as direct
calls (each ~550–1,400 tokens of schema), let the agent write code against a compact
tool API in a sandbox — reported 78–99% token reduction.
Worth it when an MCP server exposes *many* tools; overkill for one.

* * *

## 8. Hooks & Lifecycle (Cross-Agent)

Hooks let a tool inject context or enforce invariants automatically.
Support varies:

- **Claude Code** has the richest set (~29 events incl.
  `SessionStart`, `Setup`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
  `PreCompact`/`PostCompact`, `Stop`, `SubagentStart/Stop`, `SessionEnd`). Inject
  context via `additionalContext` (most events) or stdout
  (`SessionStart`/`UserPromptSubmit`). Skills can declare their own scoped `hooks:`.
- **Cursor** (6 events, incl.
  `beforeShellExecution`/`beforeMCPExecution`), **Windsurf** (pre-hooks can **block**
  via exit code 2), **Gemini CLI** (~12), and **opencode** (25+, with tool interception)
  all have lifecycle hooks.
- **Aider**, **Jules**, **Zed** have no agent hooks (Aider integrates Git pre-commit
  hooks only).

**Common, portable use**: a `SessionStart` hook that runs your CLI’s `prime`/`skill`
command to restore workflow context; a `PreCompact` hook that re-injects a brief
(`skill --brief`) before the window is trimmed.
Keep injected context small — it competes with everything else.

```jsonc
// Claude Code ~/.claude/settings.json
{
  "hooks": {
    "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "mycli prime" }] }],
    "PreCompact":  [{ "matcher": "", "hooks": [{ "type": "command", "command": "mycli skill --brief" }] }]
  }
}
```

* * *

## 9. Security & Supply Chain (Don’t Skip This)

Skills and instruction files are **executable influence** on an agent, which makes them
an attack surface. Treat them with the same care as dependencies.

- **Prompt injection via skills/instructions is real and effective**: 2026 security
  research demonstrated up to ~80% attack success against frontier models using
  malicious skills (instructions that exfiltrate data or escalate tool use).
  Anything in `AGENTS.md`, `SKILL.md`, a fetched skill, or tool output is **untrusted
  input**.
- **Vet third-party skills before install.** Prefer sources that scan (skills.sh runs
  Snyk on every install).
  Read the body and any bundled scripts.
  Pin to a commit, not a moving tag.
- **Scope tools tightly.** Use `allowed-tools` to grant the minimum (e.g.,
  `Bash(mycli:*)` not blanket `Bash`). Prefer `disable-model-invocation` for
  destructive/action-heavy skills so they require explicit invocation.
- **Lean on sandboxing.** Claude Code’s OS-level sandbox and Codex’s
  `read-only`/`workspace-write` modes contain damage; design your CLI to run within them
  and degrade gracefully (clear error, no silent failure) when writes/network are
  denied.
- **Apply the same currency discipline** you use for packages: if your skill ships a
  script with dependencies, the project’s supply-chain rules (e.g., the 14-day
  package-age rule) apply.
  See `tbd guidelines bun-monorepo-patterns` / `pnpm-monorepo-patterns`.

* * *

## 10. Emerging & Forward-Looking (Know It Exists)

You usually don’t need these to ship a skill, but they shape where the ecosystem is
going:

- **ACP (Agent Client Protocol)** — Zed’s “LSP for agents” (JSON-RPC over stdio); 25+
  agents (Claude Code, Codex, Gemini CLI, opencode) and editors (Zed, JetBrains, Kiro).
  Complements MCP (editor↔agent, while MCP is agent↔tools).
  Your agent runtime speaks it; a skill author doesn’t implement it.
- **A2A (Agent2Agent)** — Google/Linux Foundation, v1.0, 150+ orgs; for enterprise
  agent-to-agent delegation, not skill authoring.
  Ignore unless you build autonomous multi-agent systems.
- **Codex App-Server** — JSON-RPC (Thread/Turn/Item) decoupling Codex logic from client
  surfaces; relevant only for Codex-specific integration surfaces.
- **Plugin marketplaces & `npx skills`** — distribution is consolidating: Claude Code
  plugin marketplaces (official + community), Codex plugins, and Vercel’s
  `npx skills add` over the skills.sh directory (cross-agent symlinks).
- **Routines / scheduled agents, background monitors, `/run` & `/verify` skills** —
  newer Claude Code capabilities for autonomous, event-triggered, and app-verifying
  workflows (confirm GA vs.
  preview for your version before relying on them).

* * *

## 11. Best-Practices Summary

**Start simple**
1. One capability → one `SKILL.md` (name + two-part description + < 500-line body).
   Stop.
2. Project conventions → `AGENTS.md` (concise; it loads every turn).
3. Have a CLI → make it agent-friendly (`--json`, idempotent, actionable errors) and
   point a `SKILL.md` at it.

**Descriptions & disclosure** 4. Two-part rule: *what it does* + *when to use it*; third
person; front-load keywords.
5. Progressive disclosure: metadata → body → supporting files; bundle scripts
(output-only cost).
6. Respect the budget; verify the current model for your target agent
(Claude Code ≈ 1% of context window, not a flat char count).

**Scale up only when needed** 7. Many capabilities → meta-skill + informational,
self-injecting subcommands (one listing slot, unbounded resources).
This is tbd’s validated approach.
8. Path-ordered resource cache for project/user shadowing; generate `--list`
dynamically. 9. Context-injection loop with explicit `cli command arg` references; depth
≤ 3.

**Reach & surface** 10. Layer for reach: `AGENTS.md` + `SKILL.md` + CLI + (MCP if no CLI
fits). 11. Prefer CLI over MCP when a CLI exists (cheaper, more reliable); use MCP for
auth/multi-tenant/remote; consider code-execution mode for many-tool MCP servers.
12. Add agent-specific files (`.cursor/rules`, plugins, ACP) last, only where they pay
off.

**Operate safely** 13. Treat all skill/instruction content and tool output as untrusted;
vet and pin third-party skills.
14. Scope `allowed-tools` tightly; gate destructive skills; design for sandboxes.
15. Idempotent multi-agent install with marker-bounded sections; version source files,
not installed artifacts; mark generated files “DO NOT EDIT.”

* * *

## 12. Integration Checklist

**Baseline (every skill)**
- [ ] `SKILL.md` with `name` + two-part `description`
- [ ] Body < 500 lines; bulky material in supporting files one level deep
- [ ] Third-person description, trigger keywords front-loaded
- [ ] Installable via commit to `.claude/skills/` and/or `npx skills add`

**Project**
- [ ] `AGENTS.md` with build/test/style/conventions (concise)
- [ ] `CLAUDE.md` strategy decided (symlink to `AGENTS.md`, copy, or separate)

**CLI tool (if applicable)**
- [ ] `--json` on all commands; `--brief`/`--quiet`; actionable errors
- [ ] Idempotent `setup --auto`; `init` for surgical config
- [ ] Help epilog with `IMPORTANT:` + Getting Started one-liner
- [ ] `prime` (status/context) and `skill` (pure docs) commands

**Advanced (many subcommands / knowledge library)**
- [ ] Meta-skill composition (header + baseline + dynamic directory)
- [ ] Informational commands (`guidelines`/`shortcut`/`template`) with `--list`
- [ ] Path-ordered DocCache with shadowing
- [ ] Tiered skill files (baseline + brief)
- [ ] Context-injection loop, explicit references, depth ≤ 3

**Reach**
- [ ] Decide target agents; add per-agent files only where needed
- [ ] MCP server only if no CLI fits, or for OAuth/multi-tenant/remote
- [ ] Marker-bounded multi-agent install; “DO NOT EDIT” on generated files

**Security**
- [ ] Third-party skills vetted, scanned, and pinned
- [ ] `allowed-tools` minimally scoped; destructive skills gated
- [ ] CLI works within agent sandboxes and degrades gracefully

* * *

## References

### Open standards & governance

- Agent Skills standard: https://agentskills.io (spec:
  https://agentskills.io/specification)
- AGENTS.md: https://agents.md
- Agentic AI Foundation (Linux Foundation):
  https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation

### Claude Code

- Skills: https://code.claude.com/docs/en/skills
- Hooks: https://code.claude.com/docs/en/hooks
- Plugins: https://code.claude.com/docs/en/plugins
- Skill authoring best practices:
  https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Sandboxing: https://www.anthropic.com/engineering/claude-code-sandboxing

### Codex

- AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Config reference: https://developers.openai.com/codex/config-reference
- Skills: https://developers.openai.com/codex/skills
- MCP: https://developers.openai.com/codex/mcp
- Sandboxing: https://developers.openai.com/codex/concepts/sandboxing

### Other agents

- Cursor rules: https://cursor.com/docs/rules
- GitHub Copilot custom instructions:
  https://docs.github.com/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot
- Gemini CLI: https://geminicli.com/docs/cli/gemini-md/
- Windsurf AGENTS.md: https://docs.windsurf.com/windsurf/cascade/agents-md
- Cline rules: https://docs.cline.bot/customization/cline-rules
- Aider conventions: https://aider.chat/docs/usage/conventions.html
- opencode: https://opencode.ai/docs/rules/
- Amp: https://ampcode.com/manual
- pi: https://github.com/badlogic/pi-mono

### MCP & protocols

- 2026 MCP roadmap: https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/
- Code execution with MCP: https://www.anthropic.com/engineering/code-execution-with-mcp
- CLI vs MCP benchmarks: https://www.firecrawl.dev/blog/mcp-vs-cli
- ACP: https://zed.dev/acp
- A2A:
  https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year

### Distribution & ecosystem

- Vercel skills / skills.sh:
  https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem
- npx skills: https://github.com/vercel-labs/skills
- Anthropic skills (examples): https://github.com/anthropics/skills
- gstack: https://github.com/garrytan/gstack
- Beads (bd): https://github.com/gastownhall/beads

### Security

- Securing the skill ecosystem (Snyk):
  https://snyk.io/blog/snyk-vercel-securing-agent-skill-ecosystem/
- Malicious-skill research:
  https://labs.reversec.com/posts/2026/05/skill-issues-compromising-claude-code-with-malicious-skills-agents-part-1

## Related Guidelines

- TypeScript CLI implementation: `tbd guidelines typescript-cli-tool-rules`
- Supply-chain / dependency currency: `tbd guidelines bun-monorepo-patterns` or
  `pnpm-monorepo-patterns`
- Testing: `tbd guidelines general-testing-rules`
