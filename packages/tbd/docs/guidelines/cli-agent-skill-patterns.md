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
> `AGENTS.md` is governed under the Linux Foundation’s **Agentic AI Foundation (AAIF)**;
> the **Agent Skills (`SKILL.md`)** format is an open standard published at
> [agentskills.io](https://agentskills.io) and implemented by 20+ agents.
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
# or commit it to a discovery directory:
#   .agents/skills/my-skill/SKILL.md   (cross-agent: Codex, pi, others)
#   .claude/skills/my-skill/SKILL.md   (Claude Code, project)
#   ~/.claude/skills/my-skill/SKILL.md (Claude Code, personal)
```

The `SKILL.md` folder is the portable **authoring** format; some agents add their own
discovery paths (Codex/pi also read `.agents/skills/`) and their own **distribution**
layers on top (Claude Code plugins, Codex plugins) — see §5.

### 0.2 If your capability is a CLI

Most agents already know how to run CLIs from their training data, and benchmarks show a
CLI is far cheaper and more reliable than an MCP server for tools that have one (§7).
So:

1. Make the CLI **agent-friendly**: a clear `--help`, a `--json` flag on every command,
   actionable errors, and idempotent, non-interactive operation (`--yes`/`--auto`).
2. Ship a **`SKILL.md`** (or an `AGENTS.md` snippet) that tells the agent the tool
   exists, what it’s for, and the handful of commands to run.
   Reference the CLI via a **pinned zero-install runner** (`npx`/`uvx <pkg>@<version>`)
   so it works even in ephemeral/cloud environments — global install vs.
   zero-install is its own design dimension (§6.7).
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
- **Self-installs into agents & ships evolving skills?** → that is the advanced Tier 2
  pattern (self-upgrade + format versioning); most tools are Tier 1: a pure skill run
  via a **pinned** `npx`/`uvx`. (§6.0)

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
editing it. If a CLI writes a managed `AGENTS.md` block, keep that block as a compact
bootstrap: name the tool, state the always-on operating rule, and point to commands such
as `mycli prime`, `mycli skill`, `mycli shortcut --list`, and `mycli guidelines --list`.
Do not paste the full skill body or generated resource directories into `AGENTS.md`;
prefer less than 80-150 lines, and shorter is better.
If `AGENTS.md` already exists without your markers, preserve the file and append a
compact marked block instead of overwriting user content.
Version the managed block by carrying the format on the **begin marker line itself** (an
`fNN` string, like a config-format version) so future setup runs can upgrade old
generated content without touching user-authored text:

```markdown
<!-- BEGIN MYCLI INTEGRATION format=f02 surface=agents-md -->
## mycli

- Run `mycli prime` for current project context.
- Run `mycli skill` for complete skill instructions.

<!-- END MYCLI INTEGRATION -->
```

Keep the begin/end marker *names* stable (`<!-- BEGIN MYCLI INTEGRATION`) — match on
that prefix so detection finds both legacy blocks (no `format=`, treated as `f01`) and
current ones. Only the `format=fNN` value changes when the block’s shape changes.

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

### 4.4 Test the skill before publishing

Because activation is probabilistic (§4.2) and the body is executable influence, test
it:

- **Positive activation**: a few realistic prompts that *should* trigger the skill —
  does the agent invoke it?
- **Negative activation**: nearby prompts that should *not* trigger it — no false fires?
- **Explicit invocation**: `/skill-name` (or the agent equivalent) loads and runs
  cleanly.
- **Sandbox / write-denial**: the skill (and any bundled script) degrades gracefully
  when the agent runs read-only or without network (§5, Codex/Claude Code sandboxes).
- **CI validation**: lint the frontmatter (required `name`/`description`, length caps)
  and check that every referenced supporting file and link resolves.
  For a CLI-as-skill, also run every `cli guidelines/shortcut/<name>` reference and
  assert it exists.

### 4.5 Keep portable; version deliberately

- **Portability**: keep the committed `SKILL.md` to the standard fields (plus
  `allowed-tools`). Put vendor-specific behavior behind clearly labeled sections or
  generated per-agent variants rather than non-standard frontmatter that other agents
  silently drop.
- **Versioning**: for packaged skills/plugins, use semantic versions, keep a changelog,
  and state compatibility (`compatibility` field / a “requires” note).
  Pin consumers to a commit or version, not a moving tag.
- **Deprecation**: when removing or renaming a skill, leave a deprecation window with a
  pointer to the replacement; don’t silently delete an activation trigger users rely on.

* * *

## 5. Per-Agent Integration Reference

Targets differ.
This matrix reflects May 2026; verify against current docs for the agents
you care about.

| Agent | Project file | Skill / rules mechanism | MCP | Hooks | Best integration path |
| --- | --- | --- | --- | --- | --- |
| **Claude Code** | `CLAUDE.md` | Agent Skills (`SKILL.md`), `.claude/skills/`; plugins/marketplaces | Yes (stdio + Streamable HTTP) | 29 events | SKILL.md (+ plugin for distribution) |
| **Codex CLI** | `AGENTS.md` | `SKILL.md` skills + plugins (skills+MCP); `~/.codex/prompts` (deprecated) | Yes (stdio + Streamable HTTP) | Claude-compatible engine (`SessionStart`, `Pre/PostCompact`, `Pre/PostToolUse`, `UserPromptSubmit`, `Stop`, …) | AGENTS.md + skills/plugins + MCP |
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
folders with the same progressive disclosure, discovered from
repository/user/admin/system `.agents/skills/` directories.
**Plugins** are one distribution layer on top (installable units bundling skills + MCP
servers — 90+ ship with Codex), not the only install path — a plain
`.agents/skills/<name>/SKILL.md` works without packaging.
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

### 6.0 Two integration tiers — pick the lighter one

Most tools should **not** self-install.
Decide which tier you are before adding any setup machinery:

- **Tier 1 — pure skill (the default for most tools).** Ship a `SKILL.md` (optionally an
  `AGENTS.md` snippet); users install it once (commit to `.agents/skills/`,
  `npx skills add`, or the Claude mirror).
  Invoke the tool through a **version-pinned** zero-install runner —
  `npx --yes pkg@<ver>`, `uvx --from pkg@<ver>`, or `pipx run pkg==<ver>` (§6.7). No
  hooks, no managed `AGENTS.md` block, no `setup` command, no format versioning.
  Pinning the version here does **double duty**:
  - **Supply-chain control** — an unpinned runner (`npx pkg`, `uvx --from pkg`) silently
    re-resolves to the latest published version on every run and bypasses any cool-off
    window. A pinned version is the artifact you actually vetted.
  - **Consistency control** — every teammate and every agent runs the *same* tool
    version, so skill behavior is reproducible across a team and across agents rather
    than drifting as upstream publishes new releases.
- **Tier 2 — self-installing CLI (advanced; the rest of §6).** A tool that writes its
  own integration files into multiple agents (`.agents/skills/`, `.claude/skills/`, a
  managed `AGENTS.md` block, hooks, `.codex/` config) **and** whose skill content
  evolves across releases.
  Take on this complexity only for a tool with many capabilities, cross-session state,
  or a curated knowledge library.
  The self-upgrade and format-versioning rules in §6.6 apply **only to this tier** — a
  pure skill never needs them.

If in doubt, you are Tier 1. `tbd` is a Tier-2 reference implementation; most CLIs are
not.

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
Use the portable Agent Skills location as the primary project skill surface and mirror
only where a target agent requires it:

- `.agents/skills/<tool>/SKILL.md` — portable project skill for Codex, pi, OpenCode, and
  other Agent Skills clients that scan the standard project directory.
- `.claude/skills/<tool>/SKILL.md` — Claude Code compatibility mirror.
- `AGENTS.md` — compact always-on project bootstrap, not a full copy of the skill.
- `.codex/hooks.json` or `.codex/config.toml` — Codex lifecycle automation, not policy
  text or skill content.

tbd should write a CLI-managed `SKILL.md` to `.agents/skills/tbd/`, mirror it to
`.claude/skills/tbd/`, and maintain a **marker-bounded section** in `AGENTS.md` (which
also feeds Cursor, Codex, and Factory), preserving user content outside the markers:

```markdown
<!-- BEGIN MYCLI INTEGRATION format=f02 surface=agents-md -->
## mycli

- Run `mycli prime` for current project context.
- Run `mycli skill` for the full reusable skill instructions.
- Run `mycli shortcut --list` and `mycli guidelines --list` for on-demand resources.

<!-- END MYCLI INTEGRATION -->
```

**Quick recipe for a new project** (portable-first, both agents covered):

```text
.agents/skills/<tool>/SKILL.md   # canonical portable skill (Codex, Gemini, Cursor, …)
.claude/skills/<tool>/SKILL.md   # identical copy — Claude Code mirror
AGENTS.md                        # compact marked block (see above), every agent reads it
CLAUDE.md                        # symlink → AGENTS.md, or a short separate file (Claude only)
scripts/agent/<tool>-session.sh  # shared hook script, referenced by both agents
.codex/hooks.json                # Codex hook entry → shared script (or inline [hooks])
.claude/settings.json            # Claude hook entry → same shared script
```

Copy (don’t symlink) the `SKILL.md` payload to both skill paths — symlinks behave
unevenly across Windows, sandboxes, and remote worktrees.
Claude Code does **not** auto-load `AGENTS.md` (it reads `CLAUDE.md`), so a multi-agent
project needs both.

**File-ownership rules** — distinguish three categories:

- **Project instruction files** (`AGENTS.md`, `CLAUDE.md`): *commit these*. They hold
  human-authored project norms (§2). A CLI may own a **marker-bounded section** inside
  `AGENTS.md` (regenerated on setup) while the user owns everything outside the markers.
- **Fully generated install artifacts** (`.agents/skills/<tool>/SKILL.md`,
  `.claude/skills/<tool>/SKILL.md`, generated hook scripts, and the like): CLI-owned;
  mark them “DO NOT EDIT.” Pick **one of two modes** and be consistent:
  - **Commit + dogfood** (what `tbd` does): check the generated artifacts in, and add a
    **drift test** that regenerates them and fails if they differ.
    Pros: browsable on GitHub / skills.sh, the repo demonstrates its own output,
    reviewers see changes.
    Con: a regeneration shows up as a diff to commit.
    Keep generated output deterministic and formatter-stable (below) or the drift
    test/commits will churn.
  - **Gitignore + regenerate** (what `metaproc` does): add `.../skills/*/SKILL.md` to
    `.gitignore` and let `setup`/`--install` (re)create them on demand.
    Pros: zero commit churn, no drift to guard.
    Con: not browsable in the repo, and no committed artifact to diff in review.
    With this mode a format-version stamp matters less (there is no committed artifact
    for an older tool to clobber).
- **Source files** in the CLI package (header, baseline, brief): the canonical inputs —
  always version-controlled.

Make setup idempotent: dedupe hooks before merging, overwrite generated skills rather
than patching them, update only the marked section of `AGENTS.md`, and clean up legacy
files each run.

**Generated output must be deterministic.** A given input state must always produce
byte-identical output — no timestamps, no random IDs, no machine-specific paths, no
unstable ordering. This is what makes the artifact diff-stable, drift-testable, and safe
to regenerate. It must also be stable under whatever formatter the repo runs (e.g. emit
the managed block in the formatter’s canonical form — sentence-aware line wrapping,
correct quote style — so a format pass is a no-op; and don’t emit a second YAML
frontmatter block mid-document).
Because Codex and Claude Code now share a hook event schema (§8), prefer **one shared
script referenced by two thin per-agent configs**: keep the logic in a neutral location
(e.g. `scripts/agent/<tool>-session.sh`) and reference it from both
`.claude/settings.json` and the Codex `[hooks]`/`.codex/hooks.json` entry.
Do not make Codex hooks call scripts stored under `.claude/` — that couples Codex setup
to Claude setup. If a script must move out of `.claude/scripts/`, update the tbd-owned
hook commands (or leave a wrapper) so existing Claude hooks keep working.

**Upgrade existing installs deliberately (Tier 2 only).** A self-installing tool whose
skill content evolves *will* leave older generated files in users’ repos.
Treat generated integration files like config migrations:

- Version the generated surfaces with an `fNN` format code.
  Prefer **one format code for all the tool’s managed surfaces** — reuse the tool’s
  existing config/data-format version as the single source of truth (tbd stamps the
  AGENTS.md block with the same `tbd_format`, currently `f03`) rather than maintaining a
  parallel counter. Bump it when any managed surface — config schema or a generated agent
  surface — changes shape.
- Stamp the format on the generated artifact itself: on the `AGENTS.md` begin-marker
  line (`<!-- BEGIN … format=fNN … -->`), the skill “DO NOT EDIT” marker, script
  headers, or an equivalent hook signature.
  Prefer one marker line over a separate metadata comment.
- On every `setup`/`setup --auto` run, **self-upgrade in place, safely and
  idempotently**: detect older formats and rewrite only the tool-owned regions (managed
  `AGENTS.md` block, generated skills, tool-owned hooks, `.codex/` config), re-running
  cleanly with no change when already current.
- Treat old marked `AGENTS.md` blocks with no metadata as legacy generated content and
  replace only the managed region.
- Detect tool-owned hook entries by command/path/signature, replace only those entries,
  and preserve unrelated user hooks.
- **Forward-compatibility guard.** When the tool finds a generated artifact whose
  `integration-format` is **newer** than the running version understands, it must **stop
  and tell the user to upgrade the tool** (e.g. `npm install -g get-tbd@latest`) rather
  than overwrite or downgrade it.
  This is what makes pinning safe for teams: a teammate on an older version fails loudly
  instead of silently clobbering a newer managed block.
- Print an itemized setup summary: current, installed, upgraded, removed legacy, skipped
  by config, user-owned/unmarked, and format-too-new (upgrade required).
- Test upgrades from at least the previous shipped setup layout plus partial installs,
  and test that a too-new format string produces the upgrade-the-tool error.

Recommended setup flags:

| Flag | Purpose |
| --- | --- |
| `--auto` | Detect and refresh relevant project-local integrations |
| `--all` | Install every supported project-local integration surface |
| `--claude` | Install or refresh the Claude Code surface (skill mirror + hooks) |
| `--codex` | Install or refresh the Codex surface (`AGENTS.md` block + `.codex` hooks) |
| `--skip-<surface>` | Suppress a surface (e.g. `--skip-claude`) that auto-detection would otherwise update |

Use a true tri-state: with no targeting flag a surface is detection-based; a positive
flag forces it on (and suppresses auto-detection of untargeted surfaces); `--skip-*`
forces it off. Avoid Commander’s `--no-<x>` for surfaces — it defaults the value to
`true`, which would force-install on every run.
(`tbd` itself ships `--all`, `--claude`, `--codex`, `--skip-claude`, `--skip-codex`;
`AGENTS.md` installs as part of the Codex surface.)

Keep project-local setup separate from global/user setup.
Writing `~/.codex/AGENTS.md`, `~/.agents/skills/`, or `~/.claude/skills/` should be an
explicit global install command or documented manual step, not something `setup --auto`
does silently.

#### 6.6.1 Extensible skill registries (let other packages contribute skills)

A single bundled skill is enough for most tools.
But when a tool is a **platform** that other packages extend, don’t hard-code its skill
list — expose a **registry** so any installed package can contribute a skill that the
CLI discovers at runtime.

The clean implementation is the host language’s plugin mechanism:

- **Python**: an entry-point group.
  The host defines a group (e.g. `[project.entry-points."mytool.skills"]`); each plugin
  package points an entry at a factory that returns a skill spec; the host enumerates
  them with `importlib.metadata`. (`metaproc` does exactly this: a `metaproc.skills`
  group, with `metaproc skill --list` / `--install` composing each registered skill.
  Its `earnings_predictions` package registers an `eia-batch` skill that the core tool
  never hard-codes.)
- **Node/TypeScript**: a documented `package.json` key or a registration API a plugin
  calls on load.

Keep each registered skill a **spec** (name, two-part description, `allowed-tools`, a
baseline source, and an optional dynamic catalog function) and run them all through the
**same** `compose` + `--install` path, so every skill — first-party or third-party —
gets identical frontmatter, the `DO NOT EDIT`/format marker, and deterministic output.
This keeps the “one tool, many self-injecting commands” model open for extension without
the core tool taking a dependency on every plugin.

### 6.7 Making the CLI available: global install vs. zero-install

A separate design dimension from §6.6 (how the CLI installs *itself into agents*) is how
the CLI **binary** is made available so the skill can invoke it.
Decide this explicitly and state the chosen invocation in `SKILL.md`/`AGENTS.md`.

**The two ends of the spectrum** (plus a useful middle):

| Approach | How | Best when |
| --- | --- | --- |
| **Global install** | `npm i -g pkg`, `uv tool install pkg`, `pipx install pkg`, Homebrew, prebuilt binary | Persistent dev machines; offline/perf-sensitive use; the **project pins the version** (in `package.json`/lockfile or a tool manifest) so every run is identical |
| **Zero-install runner** | `npx pkg@x.y.z`, `bunx`, `pnpm dlx`, `uvx pkg@x.y.z`, `pipx run`, `go run mod@x.y.z` | Ephemeral/cloud agents (Claude Code Cloud, CI, fresh containers) where nothing persists; broad reach with no setup |
| **Persistent-on-first-use** | `uv tool install` then `uvx pkg` reuses it; a `SessionStart` bootstrap that installs once if absent | You want zero-install ergonomics *and* warm-start speed within a session |

**Trade-offs**

- **Global install** — *Pros*: fastest invocation (no per-call resolution), works
  offline, and version is managed by the project (lockfile / `package.json` / `uv` tool
  manifest), so it’s auditable and reproducible.
  *Cons*: it’s a stateful prerequisite — in ephemeral or cloud environments the global
  bin doesn’t persist, so the CLI can be **missing at session start** unless you
  bootstrap it.
- **Zero-install** — *Pros*: works in any environment with no setup; nothing to persist;
  ideal default for portability.
  *Cons*: cold-start download/cache cost on first call (uvx cold ≈ 1s, cached ≈ tens of
  ms; npx similar), needs network, and an **unpinned** invocation (`npx pkg`, `uvx pkg`)
  silently pulls the newest release.

**Cloud / ephemeral bootstrap.** If you choose global install but target cloud agents,
ship a **`SessionStart` hook** (or an `ensure-installed` script) that installs/updates
the CLI if absent before first use.
tbd does exactly this: a `tbd-session.sh` hook ensures the `tbd` CLI is present, then
runs `tbd prime`. Without a bootstrap, a globally-installed CLI referenced by a skill
will fail on a fresh cloud session.

**Pin the version (security).** Whichever you choose, the skill’s referenced invocation
should pin a version so the agent can’t silently run a newer (possibly compromised)
release — the §9 / 14-day-package-age rule applied to the runner itself:

```bash
uvx mytool@1.4.2  ...     # not `uvx mytool`
npx mytool@1.4.2  ...     # not `npx mytool@latest`
```

Global installs get the same guarantee from the lockfile/manifest; zero-install gets it
only from an explicit `@version`. Generated skill instructions should use a local-first,
pinned fallback chain:

1. Try `mycli <command>` if it is already on `PATH`.
2. Fall back to a version-pinned runner:
   - npm: `npx --yes my-package@<version> mycli <command>`
   - uv: `uvx --from my-package@<version> mycli <command>`
   - pipx: `pipx run my-package==<version> mycli <command>`
   - Go: `go run module/path@<version> <args>`
3. If the local command and pinned fallback both fail, stop and tell the user how to
   install the CLI.

Never put an unpinned network runner such as `uvx --from my-package` or `npx my-package`
in generated skill instructions unless the user explicitly opts into that risk.
This is a supply-chain control, not just ergonomics: an unpinned runner re-resolves to
the latest published version on every run and bypasses any cool-off window.
See `tbd guidelines supply-chain-hardening` for the cross-ecosystem policy.

**Current tooling (May 2026)**

- **Node / TypeScript**: zero-install via `npx <pkg>@<ver>` (`-y` to skip the prompt),
  `bunx`, `pnpm dlx`, or `deno run`; persistent via `npm i -g` / a project
  devDependency.
- **Python**: `uvx --from <pkg>@<ver> <entrypoint>` (= `uv tool run`, bundled with
  Astral’s `uv`, Rust-fast, no Python prereq) or `pipx run <pkg>==<ver>`; persistent via
  `uv tool install` / `pipx install`. `uvx` reuses a persistent install if one exists.
- **Go**: `go run <module>@<ver>` (compiles on the fly) or `go install`.
- **Rust**: no first-class zero-install runner — ship **prebuilt binaries** (GitHub
  releases + a `curl … | sh` installer) or `cargo binstall`; `cargo install` compiles.
- **Cross-language**: a prebuilt binary + install script, or a container image (Docker
  is emerging as the production-grade distribution for MCP servers).

This mirrors how the ecosystem ships agent tooling today: **MCP servers** are most often
referenced as `command: npx <pkg>` (Node) or `command: uvx <pkg>` (Python) in agent
configs; **CLIs** like Beads offer `brew` / `npm -g` / `curl` installers, while tbd uses
`npm -g` plus the bootstrap hook above.

**Recommendation**: default the skill to a **pinned zero-install invocation**
(`uvx`/`npx <pkg>@<version>`) for maximum reach across ephemeral and cloud agents; offer
**global install + a `SessionStart` bootstrap** as the optimization for persistent
environments where the project wants lockfile-managed versions and warm-start speed.

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
- **Codex** (as of May 2026) ships a **Claude-style hooks engine that uses the same
  event schema as Claude Code** — `SessionStart`, `PreCompact`/`PostCompact`,
  `PreToolUse`/`PostToolUse`, `UserPromptSubmit`, `Stop`,
  `SubagentStart`/`SubagentStop`, and `PermissionRequest`. Hooks load from `hooks.json`
  **or an inline `[hooks]` table in `config.toml`** next to an active config layer
  (`~/.codex/…` for user scope, `<repo>/.codex/…` for project scope).
  Only **command** handlers run today; `prompt`/ `agent` handlers are parsed but
  skipped. Because the schema matches Claude’s, a tool’s
  `SessionStart`/`PreCompact`/`PostToolUse` hooks map almost 1:1 across both agents.
  Repo-local hooks should resolve scripts from the git root or `.codex/`, not from
  `.claude/`, so Codex setup stays independent of Claude Code setup.
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
- **Never put secrets in skill/instruction files or tool output.** `AGENTS.md`,
  `SKILL.md`, bundled scripts, and anything a command prints get loaded into agent
  context (and often committed) — keep credentials, tokens, and keys out of them; read
  secrets from the environment at runtime instead.
- **Vet third-party skills before install.** Prefer sources that scan (skills.sh runs
  Snyk on every install).
  Read the body and any bundled scripts — review them like dependency code.
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
  package-age rule) apply — and a skill that references a zero-install runner must pin
  the version (§6.7), since unpinned `npx`/`uvx` bypasses the cool-off.
  See `tbd guidelines supply-chain-hardening` for the cross-ecosystem policy, or
  `tbd guidelines bun-monorepo-patterns` / `pnpm-monorepo-patterns` for monorepo
  specifics.

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

- One capability → one `SKILL.md` (name + two-part description + < 500-line body).
  Stop.
- Project conventions → `AGENTS.md` (concise; it loads every turn).
- Have a CLI → make it agent-friendly (`--json`, idempotent, actionable errors) and
  point a `SKILL.md` at it.

**Descriptions & disclosure**

- Two-part rule: *what it does* + *when to use it*; third person; front-load keywords.
- Progressive disclosure: metadata → body → supporting files; bundle scripts
  (output-only cost).
- Respect the budget; verify the current model for your target agent (Claude Code ≈ 1%
  of context window, not a flat char count).

**Scale up only when needed**

- Many capabilities → meta-skill + informational, self-injecting subcommands (one
  listing slot, unbounded resources).
  This is tbd’s validated approach.
- Path-ordered resource cache for project/user shadowing; generate `--list` dynamically.
- Context-injection loop with explicit `cli command arg` references; depth ≤ 3.

**Reach & surface**

- Layer for reach: `AGENTS.md` + `SKILL.md` + CLI + (MCP if no CLI fits).
- Prefer CLI over MCP when a CLI exists (cheaper, more reliable); use MCP for
  auth/multi-tenant/remote; consider code-execution mode for many-tool MCP servers.
- Add agent-specific files (`.cursor/rules`, plugins, ACP) last, only where they pay
  off.

**Operate safely**

- Treat all skill/instruction content and tool output as untrusted; vet and pin
  third-party skills.
- Scope `allowed-tools` tightly; gate destructive skills; design for sandboxes.
- Idempotent multi-agent install with marker-bounded sections; version source files, not
  fully generated install artifacts; mark generated files “DO NOT EDIT.”

* * *

## 12. Integration Checklist

**Baseline (every skill)**
- [ ] `SKILL.md` with `name` + two-part `description`
- [ ] Body < 500 lines; bulky material in supporting files one level deep
- [ ] Third-person description, trigger keywords front-loaded
- [ ] Installable via commit to `.agents/skills/`, Claude mirror at `.claude/skills/`,
  and/or `npx skills add`

**Project**
- [ ] `AGENTS.md` with build/test/style/conventions (concise)
- [ ] Managed `AGENTS.md` block uses a stable begin/end marker with a `format=fNN` field
  on the begin line
- [ ] `CLAUDE.md` strategy decided (symlink to `AGENTS.md`, copy, or separate)

**CLI tool (if applicable)**
- [ ] `--json` on all commands; `--brief`/`--quiet`; actionable errors
- [ ] Idempotent `setup --auto`; `init` for surgical config
- [ ] Help epilog with `IMPORTANT:` + Getting Started one-liner
- [ ] `prime` (status/context) and `skill` (pure docs) commands
- [ ] Invocation strategy chosen (§6.7): local-first plus pinned zero-install fallback
  by default, or global install + `SessionStart` bootstrap for cloud/ephemeral agents

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
- [ ] Existing installs upgrade item-by-item without rewriting user-owned content

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
