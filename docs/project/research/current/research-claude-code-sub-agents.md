# Research: Claude Code Sub-Agents — Architecture, Models, and Orchestration Patterns

**Date:** 2026-02-13 (last updated 2026-09-16)

**Author:** Research brief (AI-assisted)

**Status:** Complete as a Claude Code reference.
The Claude Code facts were re-verified on 2026-09-16 against the live documentation
(sub-agents, model configuration, agent teams, run agents in parallel, environment
variables, CLI reference, hooks, and cloud pages); passages that could not be
re-verified carry a dated note rather than a silent change.
Section 11 tracks the PR review lifecycle plan, which is still a draft.

**Related:**

- [Sub-agent guidance from Anthropic and OpenAI](research-2026-09-16-subagent-guidance-anthropic-openai.md):
  cross-vendor platform facts and vendor guidance, with the [V1] to [V16] citations this
  document refers to
- [PR Review Lifecycle and Sub-Agent Delegation](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md):
  the plan that defines tbd’s roles, model tiers, policy grants, and delegation
  procedure (summarized in Section 11)
- [Running Claude Code Across Environments](../archive/research-running-claude-code.md)
  — Multi-agent orchestration ecosystem survey
- [Claude Code Orchestration Interfaces and UIs](../archive/research-claude-code-orchestration-and-uis.md)
  — Control protocols, IDE surfaces, and external orchestration interfaces
- [Agent Coordination Kernel](../archive/research-agent-coordination-kernel.md)

* * *

## Overview

This document investigates how Claude Code’s sub-agent system works: what models
sub-agents use, how to control them, how context flows between parent and sub-agents,
and how the system behaves across different environments (local CLI, VS Code, cloud).
It also explores advanced orchestration patterns including loops, nested invocations
("Ralph Wiggum loops"), and custom compaction cycles.

The Claude Code sections were written in February 2026 and re-verified in September
2026\. Where behavior changed in between (model precedence, nesting, background tool
sets, the Explore model, the `effort` field, forks, the `/agents` command), the text now
describes the current behavior and names the version that changed it.
Cross-vendor facts (Codex, OpenAI guidance) live in the companion brief rather than
here. Section 11 summarizes how tbd applies these mechanics.

## Key Takeaways

**These are the most actionable findings.
Read these first.**

### Controlling the Model on Every Sub-Agent (Including Cloud)

*(Rewritten 2026-09-16. The February 2026 version said Explore always ran on Haiku and
that `CLAUDE_CODE_SUBAGENT_MODEL` overrode everything; both have changed.)*

Since v2.1.198 the built-in Explore sub-agent inherits the main conversation’s model
(capped at Opus on the Claude API); only `claude-code-guide` (Haiku) and
`statusline-setup` (Sonnet) still run on fixed smaller models
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#built-in-subagents)).
Since v2.1.251 a sub-agent’s model resolves in this order
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#choose-a-model)):

1. the per-invocation `model` parameter on the Agent tool;
2. the definition’s `model` frontmatter (`inherit` selects the main model);
3. `CLAUDE_CODE_SUBAGENT_MODEL`, when set to an alias or model ID;
4. the main conversation’s model.

So the environment variable is now a fallback, not an override.
To put every sub-agent on one model, set both variables (v2.1.257+). With the force flag
on, Claude Code ignores every definition’s `model` field, including Explore and Plan,
and Claude cannot pass a model when it starts a sub-agent:

```json
// .claude/settings.json: commit this to your repo
{
  "model": "opus",
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "opus",
    "CLAUDE_CODE_SUBAGENT_MODEL_FORCE": "1"
  }
}
```

Two consequences for this repository:

- This repository’s `.claude/settings.json` pins `CLAUDE_CODE_SUBAGENT_MODEL` to
  `claude-opus-4-6`, added in February 2026 when the variable overrode everything.
  Today it applies only to spawns that name no model in the call or the definition, and
  it then runs them on an older Opus than the `opus` alias resolves to.
  The plan spec flags the same trap in the `trading` repository; see Next Steps.
- The reasoning level (`effort`) cannot be passed per spawn.
  It comes from the definition’s `effort` field or the session’s effort level, which is
  why the plan proposes predefined tier agents (Section 11).

Settings `env` entries work in every environment (local CLI, VS Code, desktop, and cloud
sessions), because project settings travel with the repository
([settings docs](https://code.claude.com/docs/en/settings#settings-scope)). In cloud
sessions, the cloud environment’s own variables are the other reliable channel
([cloud environments](https://code.claude.com/docs/en/cloud-environments#set-environment-variables)).

**What does NOT work:**

- `export` in Bash: each Bash call runs in a fresh shell, so the variable never reaches
  the agentic loop that spawns sub-agents.
- `~/.claude/settings.json` in cloud sessions: it is not in the repository.
- `CLAUDE_ENV_FILE`: as of 2026-09-16 the variable no longer appears on the
  [environment variables page](https://code.claude.com/docs/en/env-vars), so the
  February 2026 caveat in Section 4 (that it affects only later Bash commands, not
  sub-agent spawning) could not be re-verified either way.

**To verify:** `/agents` no longer opens a panel; since v2.1.198 it prints a notice with
the definition locations.
Use `/tasks`, which shows each sub-agent’s model and effort level (v2.1.242+), or read
the transcripts at
`~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#resume-subagents)).

### Self-Managed Compaction Is Better Than Auto-Compaction

Auto-compaction (at ~95% context) progressively loses critical context with each
summarization pass. A better pattern: **the agent writes a structured handoff, then a
fresh instance picks it up with a clean context window.**

Three ways to implement this, from simplest to most powerful:

1. **tbd agent-handoff shortcut** — run `tbd shortcut agent-handoff` to generate a
   structured handoff prompt.
   Copy it into a new session.
2. **Outer loop (`claude -p`)** — the agent spawns a fresh Claude Code instance via Bash
   with a handoff document as the prompt.
   Each iteration gets a clean context window.
   (See Section 10.)
3. **Ralph Loop shell script** — a shell script runs `claude -p` in a loop,
   reading/writing state files between iterations.
   Fully autonomous. (See Section 10.)

**Key insight:** Memory persists not in the model’s context but in the **filesystem** —
git commits, handoff files, tbd issues.
Each fresh instance reads current state, does one unit of work, writes updated state.

## Questions to Answer

1. How do Claude Code sub-agents work and what models do they use?
2. How do you ensure Opus runs on both the outer agent and all sub-agents?
3. How does context transfer work between parent and sub-agents?
4. Are there differences across environments (CLI, VS Code, desktop, cloud)?
5. What are emerging best practices for sub-agent usage?
6. Can sub-agents be orchestrated in loops or complex patterns?
7. How does Claude-code-invoking-Claude-code compare to native sub-agents?
8. Can we implement custom compaction/handoff cycles?
9. How can a custom sub-agent delegation framework be built?
10. How can an agent manage its own compaction — self-restart with a handoff?
11. How does tbd apply sub-agents in its PR review and delegation workflow?

## Scope

- **Included:** Claude Code’s built-in sub-agent system (the Agent tool, formerly Task),
  custom sub-agents, agent teams, headless mode (`claude -p`), Agent SDK, model
  configuration across environments, and a summary of tbd’s sub-agent workflow
- **Excluded:** Third-party orchestrators (Gas Town, Claude Squad, etc.)
  covered in the companion research doc; MCP server architecture; Anthropic API-level
  multi-agent patterns outside Claude Code; Codex platform facts and vendor guidance,
  which the
  [2026-09-16 guidance brief](research-2026-09-16-subagent-guidance-anthropic-openai.md)
  holds

* * *

## Findings

### 1. Sub-Agent Architecture and Built-in Types

*(Re-verified 2026-09-16 against the
[sub-agents docs](https://code.claude.com/docs/en/sub-agents).)*

Claude Code’s sub-agent system works through the **Agent tool** (renamed from the Task
tool in v2.1.63; `Task(...)` still works as an alias in permission rules), which spawns
specialized AI assistants that handle specific types of tasks.
Each sub-agent runs in its **own context window** with a custom system prompt, specific
tool access, and independent permissions.
When Claude encounters a task matching a sub-agent’s description, it delegates to that
sub-agent, which works independently and returns results.

**Nesting and concurrency.** The February 2026 version of this document said sub-agents
cannot spawn other sub-agents.
That is no longer true.
By default a sub-agent can spawn sub-agents of its own, up to three layers below the
main conversation; at the depth limit Claude Code withholds the Agent tool from every
sub-agent except a fork, so the deepest sub-agent does the delegated work itself and
returns one summary.
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` changes the limit (`1` turns nesting off).
Separately, at most 20 sub-agents run at once by default
(`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`; the error is
`Concurrent subagent limit reached`); a resumed sub-agent takes a fresh slot, and
sessions with ultracode active are exempt.
Version history: nesting up to 5 layers in v2.1.172 through v2.1.216 (not configurable),
default 1 in v2.1.217 and v2.1.218, default 3 from v2.1.219
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents)).
A nested sub-agent can message the agent that launched it, and its results go back to
that launcher, not to the main conversation.

#### Built-in Sub-Agent Types

Source:
[Sub-agents docs — Built-in subagents](https://code.claude.com/docs/en/sub-agents#built-in-subagents)

| Sub-Agent | Default Model | Tools Available | Purpose |
| --- | --- | --- | --- |
| **Explore** | Inherits from the main conversation, capped at Opus on the Claude API (v2.1.198+) | Read-only; Write and Edit denied | File discovery, code search, codebase exploration |
| **Plan** | Inherits | Read-only; Write and Edit denied | Codebase research for plan mode |
| **General-purpose** | `CLAUDE_CODE_SUBAGENT_MODEL` if set, otherwise the main model | Every tool available to sub-agents | Complex research, multi-step operations, code modifications |
| **claude** | The normal resolution order (Section 2) when spawned as a sub-agent | Every tool available to sub-agents | Catch-all for tasks that fit no specialized agent |
| **statusline-setup** | **Sonnet** | Read, Edit (February 2026 listing) | Configuring the status line via `/statusline` |
| **claude-code-guide** | **Haiku** | Glob, Grep, Read, WebFetch, WebSearch (February 2026 listing) | Answering questions about Claude Code features |

*(Notes, 2026-09-16: the page no longer lists tools for the last two rows, so the
February 2026 tool lists are kept as given.
The February 2026 table also listed a “Bash” built-in that inherited the model and ran
terminal commands in a separate context; it no longer appears on the page.)*

**What changed.** In February 2026 Explore always ran on Haiku, so the most common
delegation (codebase exploration) ran on a smaller model unless overridden.
As of v2.1.198 Explore inherits the main conversation’s model, and built-in Explore and
Plan are one-shot: they return no agent ID and cannot be resumed.
Only `claude-code-guide` (Haiku) and `statusline-setup` (Sonnet) still run on fixed
smaller models. `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` (v2.1.198+) removes Explore
and Plan entirely so Claude reads and explores directly.
Explore and Plan also skip every `CLAUDE.md` and the git status snapshot that other
sub-agents receive (Section 3).

### 2. Model Selection and Control

#### How Sub-Agent Models Are Determined

*(Re-verified 2026-09-16. The February 2026 order, with `CLAUDE_CODE_SUBAGENT_MODEL`
first and the rest inferred, was correct before v2.1.251 and is now documented and
different.)*

Claude Code resolves a sub-agent’s model in this order
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#choose-a-model)):

1. **Per-invocation `model` parameter on the Agent tool.** The parent passes an alias
   (`fable`, `opus`, `sonnet`, `haiku`) or a full model ID. Since v2.1.211 the value
   also applies when the sub-agent is resumed or messaged, so it stays on that model.
2. **Per-sub-agent `model` field** in the definition’s frontmatter; `inherit` (the
   default when omitted) selects the main conversation’s model.
3. **`CLAUDE_CODE_SUBAGENT_MODEL`**, when set to an alias or model ID. It is the default
   for sub-agents, agent team teammates, and workflow agents that are not assigned a
   model another way
   ([model-config docs](https://code.claude.com/docs/en/model-config#environment-variables)).
   Since v2.1.196, setting it to `inherit` is the same as leaving it unset.
4. **The main conversation’s model.**

Two overrides sit outside this order:

- **`CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`** (v2.1.257+) makes every sub-agent, teammate,
  and workflow agent use `CLAUDE_CODE_SUBAGENT_MODEL` (or the main model when that is
  unset), ignoring definitions and per-call values
  ([sub-agents docs](https://code.claude.com/docs/en/sub-agents#run-every-subagent-on-one-model)).
- **Organization `availableModels` allowlists.** A blocked family alias such as `opus`
  is replaced by the newest allowed model of that family (on the Anthropic API and
  Claude Platform on AWS); any other blocked value falls back to the inherited model, or
  to `CLAUDE_CODE_SUBAGENT_MODEL` if set.

Accepted values for the `model` field: `sonnet`, `opus`, `haiku`, `fable`, a full model
ID such as `claude-opus-5`, or `inherit`
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)).

#### Reasoning Level (`effort`) for Sub-Agents

*(Added 2026-09-16.)* Effort is set per definition or per session, never per spawn.
The `effort` frontmatter field overrides the session effort level for that sub-agent and
accepts `low`, `medium`, `high`, `xhigh`, and `max`; the available levels depend on the
model (Fable 5.1, Fable 5, Opus 5, Sonnet 5, Opus 4.8, and Opus 4.7 accept all five;
Opus 4.6 and Sonnet 4.6 have no `xhigh`)
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields),
[model-config docs](https://code.claude.com/docs/en/model-config#adjust-effort-level)).
The Agent tool has no effort parameter, so a sub-agent without an `effort` field
inherits the session level, which comes from `CLAUDE_CODE_EFFORT_LEVEL`, `--effort`,
`/effort`, the `effortLevel` or `modelSettings` settings, or the model’s default (`high`
on most models). Agent team teammates always inherit the lead’s effort level.
`/tasks` shows each sub-agent’s model and effort (v2.1.242+). This is why the tbd plan
proposes one predefined agent per tier and reasoning level (Section 11).

#### How to Put Every Sub-Agent on One Model

*(Rewritten 2026-09-16; the February 2026 title was “How to Force Opus on All
Sub-Agents”, and its Method 1 no longer works on its own.)*

**Method 1: `CLAUDE_CODE_SUBAGENT_MODEL` with the force flag (blanket override)**

On its own, `CLAUDE_CODE_SUBAGENT_MODEL` is only a default for spawns that name no
model. Add `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` (v2.1.257+) to override definitions and
per-call values as well
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#run-every-subagent-on-one-model)):

```bash
export CLAUDE_CODE_SUBAGENT_MODEL=opus
export CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1
claude
```

Or use the `env` field in settings.json, which applies environment variables to every
session ([settings docs](https://code.claude.com/docs/en/settings#available-settings)):

```json
{
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "opus",
    "CLAUDE_CODE_SUBAGENT_MODEL_FORCE": "1"
  }
}
```

Prefer an alias (`opus`, `fable`) to a pinned ID unless you want to stay on an older
model after the alias moves: a pinned `claude-opus-4-6` now resolves to an older Opus
than `opus` does.

**Method 2: Custom sub-agents with explicit model and effort**

Create custom sub-agents in `~/.claude/agents/` or `.claude/agents/` with `model` and,
when the reasoning level matters, `effort`
([sub-agents docs — Choose the subagent scope](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope)):

```yaml
---
name: my-explorer
description: Explore codebase using Opus at high effort
tools: Read, Grep, Glob
model: opus
effort: xhigh
---

You are a codebase exploration specialist...
```

**Method 3: CLI-defined sub-agents**
([sub-agents docs — CLI-defined subagents](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope))

```bash
claude --agents '{
  "opus-explorer": {
    "description": "Explore codebase with Opus model",
    "prompt": "You are a codebase explorer...",
    "tools": ["Read", "Grep", "Glob"],
    "model": "opus"
  }
}'
```

**Method 4: Disable specific built-in sub-agents**
([sub-agents docs — Disable specific subagents](https://code.claude.com/docs/en/sub-agents#disable-specific-subagents))

You can prevent Claude from using a built-in or custom sub-agent (`Agent(...)` is the
current rule syntax; `Task(...)` still works as an alias):

```json
{
  "permissions": {
    "deny": ["Agent(Explore)"]
  }
}
```

Or via CLI: `claude --disallowedTools "Agent(Explore)"`

This makes Claude use the General-purpose sub-agent instead.
The February 2026 motivation (Explore ran on Haiku) no longer applies, since Explore now
inherits the main model; `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` (v2.1.198+) removes
Explore and Plan without a permission rule, and denying the `Agent` tool itself stops
all delegation.

#### Model Alias Resolution

Source:
[Model configuration — Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)

*(Table re-verified 2026-09-16; the February 2026 table had `opus` at Opus 4.6 and
`sonnet` at Sonnet 4.5 and did not list `fable` or `best`.)*

| Alias | Resolves to (Anthropic API, 2026-09-16) |
| --- | --- |
| `default` | Clears the override; the account type’s default (see Section 4) |
| `best` | `fable` where available, otherwise `opus` |
| `fable` | Fable 5.1 (Fable 5 through the Claude apps gateway); the top tier above Opus |
| `opus` | Opus 5 (Opus 4.6 on Microsoft Foundry) |
| `sonnet` | Sonnet 5 (Sonnet 4.6 on Claude Platform on AWS; 4.5 on Bedrock, Google Cloud, and Foundry) |
| `haiku` | Latest Haiku |
| `opus[1m]`, `sonnet[1m]` | The same models with a 1M-token context window |
| `opusplan` | Opus in plan mode, Sonnet for execution |

To pin to a specific version, use the full model ID (for example `claude-opus-5`).
Override the aliases via environment variables
([model-config docs — Environment variables](https://code.claude.com/docs/en/model-config#environment-variables)):

| Environment Variable | Overrides Alias |
| --- | --- |
| `ANTHROPIC_DEFAULT_FABLE_MODEL` | `fable` (also the ID recognized as a Fable model for fallback on third-party providers) |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `opus` (and `opusplan` plan mode) |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `sonnet` (and `opusplan` execution) |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `haiku` (and background functionality; replaces the deprecated `ANTHROPIC_SMALL_FAST_MODEL`) |
| `ANTHROPIC_DEFAULT_MODEL` | The default for new sessions (v2.1.236+); ignored if set to `default`, `inherit`, `opusplan`, or `haiku` |

#### Cost Considerations

Running every sub-agent on the top-tier model significantly increases token costs.
Anthropic’s multi-agent research system (June 2025) used Opus as lead with Sonnet
sub-agents specifically to balance capability and cost
([source](https://www.anthropic.com/engineering/multi-agent-research-system)). The
`opusplan` alias provides a hybrid: Opus for planning, Sonnet for execution
([model-config docs](https://code.claude.com/docs/en/model-config#opusplan-model-setting)).
Current vendor cost guidance (smaller models or `low` effort for simple stages,
condensed reports, few concurrent sub-agents) is collected as [V4], [V6], [V11], and
[V12] in the
[companion brief](research-2026-09-16-subagent-guidance-anthropic-openai.md); tbd’s
answer is the model tiers in Section 11.

**Token usage scales with sub-agents:** Each sub-agent has its own context window.
Running many sub-agents that each return detailed results can consume significant
context in the parent.
Agent teams use even more tokens, with each teammate being a separate Claude instance.

### 3. Context Transfer Between Parent and Sub-Agents

Source:
[Sub-agents docs — Configure subagents](https://code.claude.com/docs/en/sub-agents#configure-subagents),
[Sub-agents docs — Run subagents in foreground or background](https://code.claude.com/docs/en/sub-agents#run-subagents-in-foreground-or-background)

#### What Sub-Agents Receive

*(Re-verified 2026-09-16 against
[What loads at startup](https://code.claude.com/docs/en/sub-agents#what-loads-at-startup).
The February 2026 list omitted `CLAUDE.md` and said background sub-agents lose MCP
tools; both corrected below.)*

A non-fork sub-agent receives:
- Its **system prompt** (from the markdown body of the sub-agent definition, or the
  `prompt` field for `--agents` definitions) plus the environment details Claude Code
  appends, not the full Claude Code system prompt
- The **task message**: the prompt the parent writes on the Agent tool call
- Every **`CLAUDE.md`** the main conversation loads (`~/.claude/CLAUDE.md`, project
  rules, `CLAUDE.local.md`, managed policy files); built-in Explore and Plan skip all of
  them, and a definition with `omitClaudeMd: true` (v2.1.271+) loads only managed policy
  files
- A **git status** snapshot taken at parent session start (Explore and Plan skip it)
- If custom sub-agent: preloaded **skills** content (via `skills` field); built-ins
  preload none
- If persistent memory enabled: contents of its **memory directory**
- A **sibling roster** (v2.1.206+) naming `main` and every named agent in the session,
  when the sub-agent has `SendMessage` and at least one other agent has a name

A non-fork sub-agent does **NOT** receive:
- The parent conversation’s message history, previously invoked skills, files the parent
  already read, the output style, or auto memory
- The main conversation’s context window size (the window is sized by the sub-agent’s
  own model)
- `AskUserQuestion`, `EndConversation`, and a few other built-in tools, which Claude
  Code removes from every sub-agent
- **Background sub-agents** additionally lose most built-in tools but **keep MCP
  tools**: the retained built-ins are `Read`, `Grep`, `Glob`, `Bash`, `PowerShell`,
  `Edit`, `Write`, `NotebookEdit`, `WebFetch`, `WebSearch`, `TodoWrite`, `Skill`,
  `ToolSearch`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `TaskStop`, `SendMessage`,
  and `Artifact` (plus `SubagentHandoff` when applicable), so the same definition can
  resolve to different tools in the foreground and the background

#### Forks: The Only Way to Inherit the Conversation

*(Rewritten 2026-09-16. The February 2026 text said General-purpose, Plan, and Explore
had “access to current context”, meaning the full history.
The current docs draw the line differently: only a fork inherits history.)*

A **fork** inherits the parent’s full conversation history (including results delivered
by background sub-agents while it ran), the parent’s exact tool pool (both tool filters
are skipped), the parent’s model, and the parent’s output style; it ignores the
definition’s `model` and `tools` fields, and at the depth limit its `Agent` tool returns
an error instead of spawning
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#fork-the-current-conversation)).
The user starts one with `/subtask`; Claude also spawns forks itself where **fork mode**
is on, which it is by default in an interactive session and off under `-p` and in the
Agent SDK unless turned on.
With fork mode on, Claude Code runs every sub-agent in the background, forks and
non-forks alike, and Claude cannot ask for the foreground
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#turn-fork-mode-on-or-off)).
For tiered work this matters: a fork cannot be given a different model or effort, so
tier work must start in a fresh, named sub-agent (Section 11).

#### Customizing Context Transfer

**Via the `prompt` parameter:** The primary mechanism.
The parent agent writes a detailed prompt describing the task, and this becomes the
sub-agent’s initial instruction.
The quality of this prompt determines how well the sub-agent understands what to do.

**Via skills preloading:** The `skills` field in sub-agent configuration injects full
skill content into the sub-agent’s context at startup:

```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---
```

**Via persistent memory:** The `memory` field gives sub-agents a persistent directory
that survives across conversations:

```yaml
---
name: code-reviewer
description: Reviews code quality
memory: user  # or: project, local
---
```

Scopes: `user` (~/.claude/agent-memory/), `project` (.claude/agent-memory/), `local`
(.claude/agent-memory-local/).

**Via resuming (now `SendMessage`, not a `resume` parameter):** Resuming a sub-agent
continues with its **full previous context preserved**, including all previous tool
calls, results, and reasoning.
This is the most powerful way to maintain continuity.
*(Updated 2026-09-16.)* The February 2026 text described a `resume` parameter on the
Task tool; the current docs describe resuming by sending the finished sub-agent a
message with the `SendMessage` tool, using its agent ID or name as `to`. The sub-agent
resumes in the background without a new Agent call, keeps the tool set from its first
run, keeps the prompt cache it warmed, and (v2.1.211+) stays on any per-invocation
`model`. `SendMessage` does not require agent teams.
Built-in Explore and Plan return no agent ID and cannot be resumed; a sub-agent stopped
with `TaskStop` can be resumed once its run has exited
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#resume-subagents)). Since
v2.1.199, `SendMessage` refuses to deliver to a name that a newer agent has taken over.

#### Limitations of Context Transfer

*(Items 3 and 4 corrected 2026-09-16.)*

1. Sub-agents don’t inherit skills from the parent — must list them explicitly
2. Sub-agents don’t inherit the full Claude Code system prompt
3. Background sub-agents surface every permission prompt in the main session
   (v2.1.186+); before that they auto-denied any call that would have prompted.
   A lasting answer (for example a grant for the rest of the session) applies to the
   whole session, including the main conversation
4. Background sub-agents keep MCP tools but lose most built-in tools (list above)
5. When sub-agents complete, their results return to the main conversation — running
   many verbose sub-agents can consume significant context
6. Sub-agent transcripts are independent of the main conversation’s compaction
7. Each sub-agent’s final report is scanned before Claude reads it (v2.1.210+): text
   imitating Claude Code output (such as `<system-reminder>` tags or `Human:` lines)
   gets a backslash so it reads as plain text, and a report that matches
   instruction-shaped patterns or mentions permission settings gets a leading
   `[harness: subagent output matched instruction-shaped pattern(s): ...]` line.
   Nothing is removed or reworded, the scan does not judge intent, and a tool call the
   report leads Claude to make still passes the session’s permission checks
   ([sub-agents docs](https://code.claude.com/docs/en/sub-agents))

### 4. Environments: CLI, VS Code, Desktop, Cloud

#### Key Finding: Model Configuration Is Environment-Agnostic

There are **no IDE-specific model settings**. Model configuration is based on scope
(user, project, local) and environment variables, not on which IDE or runtime
environment you’re using.
The same settings.json and environment variables work across:

- **Local CLI** (`claude` in terminal)
- **VS Code extension** (Claude Code as VS Code plugin)
- **Desktop app** (standalone Claude Code app)
- **Claude Code Cloud** (web-based sessions)

The sub-agent mechanism is the same across all environments.
The Agent tool works identically whether you’re in VS Code, the desktop app, or the CLI.
The one behavioral difference is between interactive and non-interactive sessions: fork
mode is on by default in an interactive session (every sub-agent runs in the background)
and off under `-p` and in the Agent SDK, and agent teams never spawn teammates under
`-p` (Sections 3 and 6).

#### Settings Precedence (Same Everywhere)

Source:
[Settings docs — Settings scope](https://code.claude.com/docs/en/settings#settings-scope)

1. **Managed** (enterprise, cannot override)
2. **Command line arguments** (temporary session overrides)
3. **Local** (`.claude/settings.local.json` — per-project personal)
4. **Project** (`.claude/settings.json` — team-shared)
5. **User** (`~/.claude/settings.json` — personal global)

#### How to Set Model in Each Environment

Source:
[Model configuration — Setting your model](https://code.claude.com/docs/en/model-config#setting-your-model)

| Environment | How to Set Model |
| --- | --- |
| CLI | `claude --model opus` or `ANTHROPIC_MODEL=opus` or settings.json |
| VS Code | settings.json (project or user level) or environment variables |
| Desktop app | settings.json or `/model opus` during session |
| Cloud | `/model opus` during session or settings.json |
| Any (session) | `/model opus` to switch mid-session |

#### How to Set Sub-Agent Model in Each Environment

Same approach everywhere *(example updated 2026-09-16: an alias instead of a pinned ID,
and the force flag, without which the variable is only a fallback; see Section 2)*:

```json
// settings.json (any scope)
{
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "opus",
    "CLAUDE_CODE_SUBAGENT_MODEL_FORCE": "1"
  }
}
```

Or set `CLAUDE_CODE_SUBAGENT_MODEL` as an actual environment variable before launching
Claude Code.

#### Cloud-Specific Considerations

*(Re-verified 2026-09-16 against
[Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web).
The product is now described as “cloud sessions”, started from the browser at
claude.ai/code, the mobile and desktop apps, `claude --cloud`, or routines; the February
2026 name “Claude Code Cloud” is kept below.
The page confirms that sub-agents “work the same way they do locally”, that
`.claude/agents/` definitions are picked up automatically, and that agent teams can be
enabled with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in the environment variables.)*

Claude Code Cloud runs in isolated, Anthropic-managed VMs (or an organization’s
self-hosted environment) that clone your GitHub repository.
Sub-agents work normally within a cloud session.
However there are important differences in how configuration reaches the environment.

**What IS available in Cloud sessions:**
- `.claude/settings.json` (project-level, committed to Git) — **YES**
- `.claude/agents/` (project-level sub-agent definitions) — **YES**
- Cloud environment dialog settings (env vars in `.env` format) — **YES**
- Server-managed settings (Enterprise/Teams) — **YES**
- `/model` command during session — **YES**

**What is NOT available in Cloud sessions:**
- `~/.claude/settings.json` (user-level) — **NO** (not in the repo)
- `.claude/settings.local.json` (gitignored) — **NO**
- Shell `export` commands — **NO** (each Bash runs in a fresh shell)

**Three methods to set `CLAUDE_CODE_SUBAGENT_MODEL` in Cloud:**

**Method 1: Cloud environment dialog (recommended for Cloud)**

On claude.ai, when adding or editing an environment, there’s a dialog where you can
specify environment variables in `.env` format
([cloud environments](https://code.claude.com/docs/en/cloud-environments#set-environment-variables);
example updated 2026-09-16):

```
CLAUDE_CODE_SUBAGENT_MODEL=opus
CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1
ANTHROPIC_MODEL=opus
```

**Method 2: Project settings.json `env` field (recommended for teams)**

Commit this to your repository so it takes effect for all Cloud sessions:

```json
// .claude/settings.json (committed to git)
{
  "model": "opus",
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "opus",
    "CLAUDE_CODE_SUBAGENT_MODEL_FORCE": "1"
  }
}
```

**Method 3: SessionStart hook writing to CLAUDE_ENV_FILE**

For dynamic setup, a SessionStart hook can write env vars:

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "echo 'export CLAUDE_CODE_SUBAGENT_MODEL=opus' >> \"$CLAUDE_ENV_FILE\""
      }]
    }]
  }
}
```

Note: `CLAUDE_ENV_FILE` makes variables available to subsequent Bash commands but may
not affect Claude Code’s internal sub-agent spawning if the variable is only read at
startup. The `env` field in settings.json is more reliable.
*(Not re-verified 2026-09-16: `CLAUDE_ENV_FILE` no longer appears on the
[environment variables page](https://code.claude.com/docs/en/env-vars), so this method
may not work at all; treat Methods 1 and 2 as the supported ones.)*

**Important: `export` in Bash does NOT work for sub-agent model control.** Each Bash
command runs in a fresh shell, and environment variables set within Bash are not visible
to Claude Code’s agentic loop that spawns sub-agents.

**How to verify which model sub-agents are using:**

*(Updated 2026-09-16.)*

1. `/status`: shows current main model and account info
2. `/tasks`: lists background items including finished sub-agents, with each sub-agent’s
   model and effort level (v2.1.242+); `/agents` no longer opens a panel (v2.1.198+), it
   prints the definition locations
3. `/model`: shows current model; `/effort` sets or shows the effort level
4. Sub-agent transcripts at
   `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`
5. Ask Claude directly: “What model are your sub-agents configured to use?”
   A sub-agent cannot reliably report its own configuration, which is why the tbd review
   header records the *requested* tier, model, and level (Section 11)

**Does `/model` affect sub-agents?** Yes, for those that inherit, following the
documented resolution order (Section 2):
- Sub-agents with `model: inherit` (or no model field) **will** follow `/model`, unless
  `CLAUDE_CODE_SUBAGENT_MODEL` is set, in which case that variable wins over the main
  model for them
- Sub-agents with an explicit model in the call or the definition **will not**
- Built-in Explore follows `/model` too (it inherits as of v2.1.198; the February 2026
  claim that it stays on Haiku is stale)
- `CLAUDE_CODE_SUBAGENT_MODEL` alone overrides nothing that names a model; only
  `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` overrides everything
- Agent team teammates fix their model at spawn; `/model` changes only the lead

**Other considerations** *(updated 2026-09-16)*:
- Cloud sessions can be started from a terminal with `claude --cloud "task"` (each call
  makes an independent session; `--remote` is a deprecated alias), and a follow-up
  message can be queued into a running cloud session with
  `claude -p "message" --cloud <session-id>`; the CLI cannot push an existing local
  session to the cloud
- [Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging)
  lets Claude list and message the user’s other sessions, local or cloud, so the
  February 2026 claim of “no instance-to-instance communication” no longer holds; there
  is still no orchestration API beyond this and the Agent SDK
- Teleport (`claude --teleport <id>`, or `/teleport` and `/tp` in a session) pulls a
  cloud session and its branch into the local terminal as a separate copy; new local
  work does not flow back to the cloud session
- When a cloud environment expires, background work that was still running (sub-agents
  and shell commands) is not restored on reopen

#### Default Model by Account Type

Source:
[Model configuration — `default` model setting](https://code.claude.com/docs/en/model-config#default-model-setting)

*(Table re-verified 2026-09-16; the February 2026 table listed Opus 4.6 throughout.)*

| Account Type | Default Model (2026-09-16) |
| --- | --- |
| Max, Team Premium, Enterprise, Anthropic API | Opus 5 |
| Pro, Team Standard | Sonnet 5 |
| Claude Platform on AWS, Amazon Bedrock, Google Cloud Agent Platform | Opus 5 |
| Microsoft Foundry | Sonnet 4.5 |

An organization default model (v2.1.196+) replaces these when an admin sets one.

**Fallback.** The February 2026 text said Claude Code may fall back to Sonnet at a usage
threshold; that is not on the model-config page as of 2026-09-16 and could not be
re-verified. What the page documents:
- **Availability fallback:** `--fallback-model sonnet,haiku` or a `fallbackModel` list
  in settings switches models when the primary is overloaded or returns a non-retryable
  server error. When a sub-agent’s request fails over (v2.1.247+), the sub-agent
  continues on the fallback model and the session’s model is unchanged.
- **Content-based fallback:** safety classifiers can move a Fable 5.x or Opus 5 request
  to an older model for flagged categories; the session then stays on that model until
  `/model` is run. Either kind can put strong-tier work on a weaker model without the
  coordinator noticing, another reason the tbd plan records the requested tier rather
  than trusting a sub-agent’s self-report.

### 5. Emerging Best Practices for Sub-Agents

#### When to Use Sub-Agents vs Main Conversation

**Use the main conversation when:**
- The task needs frequent back-and-forth or iterative refinement
- Multiple phases share significant context (planning → implementation → testing)
- You’re making a quick, targeted change
- Latency matters (sub-agents start fresh and need time to gather context)

**Use sub-agents when:**
- The task produces verbose output you don’t need in your main context
- You want to enforce specific tool restrictions or permissions
- The work is self-contained and can return a summary
- You want to isolate high-volume operations (test runs, log analysis)

#### Effective Sub-Agent Patterns

1. **Isolate high-volume operations:** Running tests, fetching docs, or processing logs
   in sub-agents keeps verbose output out of the main context.

2. **Run parallel research:** Spawn multiple sub-agents for independent investigations.
   Each explores its area, then Claude synthesizes findings.

3. **Chain sub-agents:** For multi-step workflows, use sub-agents in sequence.
   Each completes its task and returns results, which Claude passes to the next.

4. **Specialize with focused prompts:** Each sub-agent should excel at one specific
   task. Write detailed descriptions so Claude knows when to delegate.

5. **Limit tool access:** Grant only necessary permissions for security and focus.
   A reviewer doesn’t need Write/Edit access.

6. **Use resume for continuity:** When a sub-agent needs to continue previous work,
   message it with `SendMessage` (by agent ID or name) instead of starting fresh
   (Section 3). Give a sub-agent a `name` at spawn when you expect to come back to it.

7. **Preload skills:** Use the `skills` field to inject domain knowledge without the
   sub-agent having to discover and load it during execution.

8. **Persistent memory:** Enable `memory` for sub-agents that benefit from learning
   across sessions (e.g., a code reviewer that remembers project patterns).

#### Anthropic’s Own Multi-Agent Patterns

Anthropic published their internal multi-agent research system architecture:
- **Orchestrator-worker pattern**: Claude Opus 4 as lead, Claude Sonnet 4 sub-agents
- **90.2% improvement** over single-agent Opus 4 on internal evaluations
- **Token scaling**: Agents use 4x more tokens than chat; multi-agent uses 15x more

#### Cost-Optimization Strategies

*(Updated 2026-09-16.)*

- Use `opusplan` alias (Opus for planning, Sonnet for execution)
- Explore now inherits the main model (v2.1.198+); to push exploration and other unnamed
  spawns to a cheaper model, set `CLAUDE_CODE_SUBAGENT_MODEL=haiku` (a default), or add
  `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` to make it apply everywhere
- Use `maxTurns` in the definition (partial output is marked as such, v2.1.246+) or
  `--max-turns` for `-p` runs to bound sub-agent execution; a per-invocation `max_turns`
  parameter is not documented (Section 6)
- Use `effort: low` or `medium` in definitions for simple mechanical sub-agents, per
  Anthropic’s effort guidance ([V6] in the companion brief)
- Background is now the default in interactive sessions; foreground only applies under
  `-p` or when fork mode is off
- Consider whether agent teams (higher token cost) are justified vs simple sub-agents

#### Parallel Surfaces Added Since February 2026

*(Added 2026-09-16 from
[Run agents in parallel](https://code.claude.com/docs/en/agents).)* Claude Code now
documents four ways to run work in parallel, plus supporting tools; this document covers
the first and third in depth.

| Approach | What it gives you | Status |
| --- | --- | --- |
| Sub-agents | Delegated workers inside one session, own context, return a summary | Stable |
| Agent view (`claude agents`) | One screen to dispatch and monitor background sessions; a dispatched session moves into its own worktree before editing | Research preview |
| Agent teams | Coordinated sessions with a shared task list and messaging, managed by a lead | Experimental, off by default |
| Dynamic workflows (`/workflows`) | A script that runs many sub-agents and cross-checks their results, for jobs too big for one turn | Documented; see [workflows](https://code.claude.com/docs/en/workflows) |

Supporting tools: [worktrees](https://code.claude.com/docs/en/worktrees) (a separate
checkout per session or sub-agent), cross-session messaging (Claude messages the user’s
other sessions), and `/batch` (a packaged skill that splits one large change into 5 to
30 worktree-isolated sub-agents that each open a PR). The page’s rule of thumb:
sub-agents when Claude delegates and collects inside one conversation; agent view when
the user hands off independent tasks; teams when Claude must plan, assign, and
supervise; workflows when a script should hold the plan.

### 6. Sub-Agent Orchestration Patterns

#### Loops and Iteration

**Native sub-agents cannot run in loops by themselves.** The Agent tool spawns a
sub-agent, it runs, and it returns a result.
There is no built-in loop construct.
However, the **main agent** can implement loops:

```
Pattern: Main agent drives the loop
1. Main agent spawns sub-agent A with task
2. Sub-agent A returns results
3. Main agent evaluates results
4. If not satisfactory, spawns sub-agent A again (or resumes it)
5. Repeat until done
```

Resuming is key here: messaging a finished sub-agent with `SendMessage` continues it
with its full previous context, so the sub-agent doesn’t lose track of what it was doing
(Section 3). Dynamic workflows (Section 5) are the documented way to run a loop that a
script, rather than Claude’s turn-by-turn judgment, controls.

#### Background Sub-Agents (Parallelism)

*(Rewritten 2026-09-16 against
[Run subagents in foreground or background](https://code.claude.com/docs/en/sub-agents#run-subagents-in-foreground-or-background).
The February 2026 text said results arrive only through an `output_file`, that
background sub-agents auto-deny permission prompts, and that they lose MCP tools; none
of that matches the current docs.)*

Background is now the default: with fork mode on (the default in interactive sessions)
every sub-agent runs in the background and Claude cannot ask for the foreground.
Claude Code picks foreground only when an in-process teammate spawned the sub-agent,
when `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` is set, or, with fork mode off, when
Claude asks for the foreground and the definition does not set `background: true`.

```
Main agent:
  ├── Spawns sub-agent A (background) → runs concurrently
  ├── Spawns sub-agent B (background) → runs concurrently
  ├── Continues own work
  ├── Receives A's completion notification in a later turn
  └── Receives B's completion notification in a later turn
```

Background sub-agents:
- Run concurrently while the main agent continues
- **Deliver results as a completion notification in a later turn.** Claude waits for
  that notification before reporting the sub-agent’s results, and if asked about
  progress first, it reports that the sub-agent is still running.
  The February 2026 `output_file` mechanism is no longer documented; read the transcript
  under `~/.claude/projects/{project}/{sessionId}/subagents/` if raw output is needed
- **Surface permission prompts in the main session** (v2.1.186+); a lasting answer
  applies to the whole session
- Keep MCP tools but get a reduced set of built-in tools (Section 3)
- Cannot ask clarifying questions, because `AskUserQuestion` is removed from every
  sub-agent
- Can be resumed with `SendMessage` once finished or stopped
- Cannot outlive an in-process teammate: a teammate’s own sub-agents run in the
  foreground, and a `background: true` definition errors there

#### Bounding Execution: `maxTurns`

*(Updated 2026-09-16.)* The February 2026 text described a per-invocation `max_turns`
parameter on the Task tool.
As of 2026-09-16 the documented cap is the definition’s `maxTurns` frontmatter field
(when a sub-agent stops at the limit, its output is marked partial and Claude can
message it to continue, v2.1.246+) and, for `-p` runs, the `--max-turns` and
`--max-budget-usd` flags.
A per-invocation parameter could not be re-verified in the
[tools reference](https://code.claude.com/docs/en/tools-reference) and is not in the
Agent tool schema observed in a 2026-09-16 desktop session.

Bounding turns is useful for:
- Preventing runaway sub-agents that consume too many tokens
- Creating “time-boxed” exploration tasks
- Implementing work-then-report patterns
- Budgeting sub-agent work in orchestration loops (e.g., 20-30 turns per iteration)

#### Agent Teams (Experimental) — For Complex Coordination

*(Re-verified 2026-09-16 against
[Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams);
still experimental and disabled by default.)*

When sub-agents are insufficient because workers need to **communicate with each
other**, agent teams provide:
- Shared task lists with self-coordination (for agents that have the Task tools, which
  are available by default only on older model families; others coordinate by message)
- Direct inter-agent messaging (not just report-to-parent)
- Teammates are full, independent Claude Code sessions that load `CLAUDE.md`, MCP
  servers, and skills like a regular session, but not the lead’s history
- Team lead coordinates, assigns tasks, synthesizes results
- Enabled with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; since v2.1.178 there is no
  setup step and cleanup is automatic

Two behaviors matter for delegation designs:
- **Named sub-agents become teammates.** While teams are enabled, any Agent call that
  carries a `name` (other than a fork or a call that passes `isolation`) launches a
  teammate, and Claude names sub-agents on its own, so teams can form unasked.
  Set the variable to `0` to get ordinary sub-agents back.
- **Teammate models follow the sub-agent order**: the spawn prompt’s model, then a named
  definition’s `model`, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the lead’s model; the
  force flag overrides the first two.
  Teammates inherit the lead’s effort level and fix their model at spawn.
  Teammates start with the lead’s permission mode (except `dontAsk`), their prompts
  appear in the lead’s session, and a message from another agent never counts as the
  user’s approval.

**Sub-agents vs Agent Teams:**

| Aspect | Sub-agents | Agent Teams |
| --- | --- | --- |
| Context | Own window, results return to caller | Own window, fully independent |
| Communication | Return a result to the caller; named sub-agents can also message each other (v2.1.206+) | Teammates message each other directly |
| Coordination | Main agent manages all work | Self-coordination by messages, plus a shared task list where the Task tools exist |
| Best for | Focused tasks where only result matters | Complex work requiring discussion |
| Token cost | Lower (results summarized) | Higher (each teammate = separate instance) |
| Nesting | Up to 3 layers by default (configurable) | No nested teams; teammates can spawn foreground sub-agents |
| Worktrees | `isolation: worktree` per sub-agent | Not isolated; partition files per teammate |

Documented limits (2026-09-16): no session resumption for in-process teammates, task
status can lag, shutdown can be slow, one team per session, the lead is fixed,
per-teammate permission modes cannot be set at spawn, and split panes need tmux or
iTerm2. The docs suggest starting with 3 to 5 teammates and 5 to 6 tasks per teammate.

### 7. Claude-Code-Invoking-Claude-Code ("Ralph Wiggum" Loops)

> **See also:**
> [Claude Code Orchestration Interfaces and UIs](../archive/research-claude-code-orchestration-and-uis.md)
> covers the protocol/interface perspective on instance-from-instance orchestration —
> including the Agent SDK, `--sdk-url` WebSocket protocol, and ACP as alternative
> control surfaces for outer-loop patterns.

#### The Pattern

The “Ralph Wiggum loop” (or outer-loop pattern) involves Claude Code invoking another
Claude Code instance as a subprocess via the Bash tool, using the `-p`
(print/non-interactive) flag:

```bash
# Basic pattern: Claude Code invokes Claude Code
claude -p "Analyze auth.py and fix security issues" \
  --allowedTools "Read,Edit,Bash" \
  --output-format json
```

This is fundamentally different from native sub-agents:

| Aspect | Native Sub-Agent (Agent tool) | Claude-via-Bash (`claude -p`) |
| --- | --- | --- |
| Context isolation | Fresh context (plus `CLAUDE.md`), unless forked | Complete isolation (fresh process) |
| Model control | Per-call `model`, definition `model` and `effort`, env var | Full CLI flag control (`--model opus --effort xhigh`) |
| System prompt | Sub-agent definition only | Full customization (`--system-prompt`) |
| Tool access | Configured in sub-agent definition | `--allowedTools`, `--disallowedTools` |
| Session persistence | Transcript in sub-agent directory | Optional (`--session-id`, `--continue`) |
| Output format | Returns to parent via the Agent tool (completion notification when in the background) | stdout (text, json, stream-json) |
| Compaction | Built-in auto-compaction | Built-in auto-compaction |
| Cost | Shares API connection | Separate API calls |
| Nesting | Up to 3 layers by default (configurable) | Can nest arbitrarily deep |
| Permission | Inherits from parent + sub-agent config | Fully independent permission mode |
| MCP servers | Inherits from parent; a definition can scope its own `mcpServers` | Must configure independently |
| Background execution | `run_in_background` parameter | Shell backgrounding (`&`, etc.) |

#### Advantages of Claude-via-Bash Over Native Sub-Agents

1. **Arbitrary nesting:** Native sub-agents nest three layers deep by default
   (configurable, Section 1); `claude -p` invocations can nest as deep as needed.

2. **Full CLI control:** Every CLI flag is available — `--model`, `--system-prompt`,
   `--append-system-prompt`, `--allowedTools`, `--max-turns`, `--max-budget-usd`,
   `--json-schema`, etc.

3. **Complete isolation:** Each invocation is a fresh process with its own context
   window, no risk of context pollution.

4. **Session continuity:** Use `--session-id` and `--continue`/`--resume` to maintain
   state across invocations, enabling explicit compaction boundaries.

5. **Structured output:** `--output-format json` with `--json-schema` provides validated
   structured output, useful for machine-readable handoffs.

6. **Budget limits:** `--max-budget-usd` prevents runaway costs per invocation.

#### Disadvantages of Claude-via-Bash

1. **Higher latency:** Each invocation starts a fresh process (loading configuration,
   connecting to API, etc.)

2. **No shared context:** Must explicitly pass all context via prompts, files, or piping
   — no automatic context inheritance.

3. **Higher token cost:** No prompt caching benefit between separate invocations (though
   each invocation benefits from its own caching).

4. **Process management complexity:** Must handle process lifecycle, error recovery, and
   output parsing.

5. **No automatic resume:** If the outer agent’s context compacts, it may lose track of
   inner invocations unless handoff state is persisted to files.

#### Implementing a Custom Compaction/Handoff Cycle

This is the most interesting application of the outer-loop pattern.
The idea:

```
Outer Claude Code (orchestrator):
  Loop:
    1. Spawn inner Claude Code with task + context file
    2. Inner Claude Code works until max_turns or budget limit
    3. Inner Claude Code writes handoff document to file
    4. Inner Claude Code exits
    5. Outer agent reads handoff document
    6. Outer agent decides whether to continue or finish
    7. If continue, spawn new inner Claude Code with updated context
```

**Example implementation:**

```bash
# Outer orchestrator could run this loop pattern:

# Step 1: Write initial task context
echo "Task: Refactor auth module. Phase 1: Analysis." > /tmp/task-context.md

# Step 2: First inner invocation
claude -p "$(cat /tmp/task-context.md)" \
  --model opus \
  --allowedTools "Read,Grep,Glob,Bash,Edit,Write" \
  --append-system-prompt "When you finish or hit limits, write a handoff \
    document to /tmp/handoff.md describing: what you did, what remains, \
    key findings, and recommended next steps." \
  --max-turns 20 \
  --output-format json > /tmp/result-1.json

# Step 3: Read handoff and decide whether to continue
# (The outer Claude Code can read /tmp/handoff.md and evaluate)

# Step 4: Second inner invocation with updated context
claude -p "Continue the work described in this handoff: $(cat /tmp/handoff.md)" \
  --model opus \
  --allowedTools "Read,Grep,Glob,Bash,Edit,Write" \
  --append-system-prompt "..." \
  --max-turns 20 \
  --output-format json > /tmp/result-2.json
```

**A more sophisticated pattern using session continuity:**

```bash
# First invocation creates a session
session_id=$(claude -p "Start refactoring auth module" \
  --output-format json | jq -r '.session_id')

# Continue the same session (preserves full history)
claude -p "Continue the refactoring" --resume "$session_id" \
  --output-format json

# Fork the session (new ID but inherits history)
claude -p "Try an alternative approach" \
  --resume "$session_id" --fork-session \
  --output-format json
```

#### The Full Outer Loop Architecture

For a fully orchestrated outer loop, the outer Claude Code instance would:

1. **Plan:** Use plan mode or a planning sub-agent to break work into phases
2. **Execute phases:** For each phase, invoke `claude -p` with:
   - Phase-specific system prompt
   - Context from previous phases (via files)
   - Budget/turn limits
   - Structured output requirements
3. **Evaluate:** Read the inner agent’s output and handoff document
4. **Decide:** Continue, retry, or finish
5. **Persist state:** Write orchestration state to files (not just context)

```
┌─────────────────────────────────────────────┐
│  Outer Claude Code (Orchestrator)           │
│                                             │
│  CLAUDE.md: "You are an orchestrator..."    │
│  Loop:                                      │
│    ├── Read task-state.json                 │
│    ├── Determine next phase                 │
│    ├── Invoke: claude -p "phase N" ...      │
│    │     └── Inner Claude Code              │
│    │          ├── Works on phase            │
│    │          ├── Writes handoff.md         │
│    │          └── Exits                     │
│    ├── Read handoff.md                      │
│    ├── Update task-state.json               │
│    └── If more work: continue loop          │
└─────────────────────────────────────────────┘
```

**Advantages of this architecture:**
- Each inner invocation gets a fresh context window (no compaction needed)
- Handoff documents provide explicit, curated context (better than auto-compaction)
- The outer agent can use different models/prompts for different phases
- Budget and turn limits prevent runaway costs per phase
- State is persisted to files, surviving even if the outer agent compacts

**Disadvantages:**
- More complex to set up and debug
- Higher total token cost (no shared prompt caching)
- Latency from process startup per invocation
- Requires careful handoff document design
- The outer agent itself will eventually hit context limits

#### Can We Do This Today?

**Yes.** All the pieces exist:

1. `claude -p` for non-interactive invocations ✓
2. `--model` for per-invocation model control ✓
3. `--append-system-prompt` for custom prompts ✓ (2026-09-16: `--system-prompt` and
   `--system-prompt-file` were not found on the
   [CLI reference](https://code.claude.com/docs/en/cli-reference); the listed flags are
   `--append-system-prompt`, `--append-subagent-system-prompt`, and
   `--append-subagent-system-prompt-file`, so the examples above that use
   `--system-prompt` should be checked against `claude --help` before use)
4. `--max-turns` and `--max-budget-usd` for bounded execution ✓
5. `--output-format json` for structured output ✓
6. `--resume`, `--continue`, and `--fork-session` for session continuity ✓
7. `--allowedTools` for per-invocation tool control ✓
8. `--agents` for per-invocation custom sub-agents ✓
9. `--model`, `--effort`, and `--fallback-model` per invocation ✓ (verified 2026-09-16)
10. Bash tool for invoking `claude -p` from within Claude Code ✓

The **Claude Agent SDK** (Python and TypeScript packages) provides even more
programmatic control.
*(Updated 2026-09-16: the packages were renamed from the Claude Code SDK to the Claude
Agent SDK; the Python repository is
[`anthropics/claude-agent-sdk-python`](https://github.com/anthropics/claude-agent-sdk-python)
and the docs include a
[migration guide](https://code.claude.com/docs/en/agent-sdk/migration-guide).
The SDK supports sub-agents with depth, concurrency, and spend caps; see [V5] in the
companion brief.)*

```python
# PSEUDOCODE: illustrates the concept, not the exact API.
# Real SDK: `pip install claude-agent-sdk`; see
# https://code.claude.com/docs/en/agent-sdk/python for the current entry points.

from claude_agent_sdk import query, ClaudeAgentOptions  # check the current reference

async for message in query(
    prompt="Refactor the auth module",
    options=ClaudeAgentOptions(
        model="opus",
        system_prompt="You are a refactoring specialist...",
        allowed_tools=["Read", "Edit", "Bash"],
        max_turns=20,
    ),
):
    ...
```

### 8. Comparison: Native Sub-Agents vs Agent Teams vs Outer Loop

*(Table updated 2026-09-16; the February 2026 rows for model control, inter-agent
communication, and nesting depth were stale.)*

| Dimension | Native Sub-Agents | Agent Teams (Experimental) | Outer Loop (claude -p) |
| --- | --- | --- | --- |
| Setup complexity | Low (built-in) | Medium (experimental flag) | High (custom orchestration) |
| Model control | Per-call `model`; definition `model` and `effort`; env var as fallback or forced | Spawn prompt or definition model; effort inherited from the lead | Full CLI control (`--model`, `--effort`) |
| Context isolation | Full (fresh context plus `CLAUDE.md`), unless forked | Full | Full |
| Inter-agent comms | Report to parent; named sub-agents can message each other | Direct messaging and shared task list | Via files/handoff docs |
| Nesting depth | 3 layers by default (configurable) | No nested teams; teammates may spawn foreground sub-agents | Unlimited |
| Parallelism | Background by default in interactive sessions | Native (in-process, tmux, or iTerm2) | Shell backgrounding |
| Custom compaction | No | No | Yes (explicit handoffs) |
| Session persistence | Sub-agent transcripts (resumable in the same session) | Teammate transcripts; in-process teammates not restored by `/resume` | Full session persistence |
| Token efficiency | Good (shared caching) | Low (separate instances) | Low (separate processes) |
| Maturity | Stable | Experimental, disabled by default | DIY (all stable primitives) |
| Permission control | Inherited + overrides | Inherited from the lead at spawn | Fully independent |

### 9. Creating Custom Sub-Agent Delegation Frameworks

#### Yes, Custom Sub-Agents Are a First-Class Extension Point

Claude Code’s sub-agent system is designed to be extended.
You can create your own sub-agents that participate in the same delegation framework as
the built-in ones. Claude uses each sub-agent’s `description` field to decide when to
delegate, so a well-described custom sub-agent will be automatically invoked for
matching tasks.

#### How Delegation Works (and How to Customize It)

The delegation flow is:

1. Claude encounters a task in the conversation
2. Claude evaluates available sub-agents' `description` fields
3. If a sub-agent matches, Claude delegates via the Agent tool
4. The sub-agent runs with its own system prompt, tools, and model
5. Results return to the main conversation

You can influence this at every step:

**Control which sub-agents exist** (`.claude/agents/` or `~/.claude/agents/`):
- Create project-specific sub-agents that your team shares
- Create personal sub-agents for your own workflows
- Distribute sub-agents via plugins

**Control which sub-agents can be used** (permissions; `Agent(...)` syntax since
v2.1.63, with `Task(...)` kept as an alias):
- `deny` specific sub-agents: `"permissions": { "deny": ["Agent(Explore)"] }`
- `--disallowedTools "Agent(my-agent)"` on the CLI
- Restrict which sub-agents a main-session agent can spawn:
  `tools: Agent(worker, researcher)` (see below for where this applies)
- Deny the `Agent` tool itself to stop all delegation

**Control delegation behavior** (hooks; re-verified 2026-09-16 against the
[hooks reference](https://code.claude.com/docs/en/hooks)):
- `SubagentStart` hook fires when any sub-agent begins: run setup scripts; the matcher
  filters on `agent_type` (the definition’s `name`)
- `SubagentStop` hook fires when any sub-agent completes: run cleanup; a `Stop` hook
  written in a sub-agent’s frontmatter is converted to `SubagentStop`
- `PreToolUse` hooks within sub-agents validate operations before execution
- `PostToolUse` hooks within sub-agents run after tool operations
- Hooks in a definition’s `hooks` field are ignored for plugin sub-agents

**Example: A custom delegation framework with pre/post hooks**

```yaml
# .claude/agents/guarded-coder.md
---
name: guarded-coder
description: Implement code changes with mandatory pre-commit validation.
  Use proactively when making code changes.
tools: Read, Edit, Write, Bash, Grep, Glob
model: opus
permissionMode: acceptEdits
hooks:
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/lint-changed-files.sh"
  Stop:
    - hooks:
        - type: command
          command: "./scripts/run-tests-on-changes.sh"
---

You are a senior developer. When implementing changes:
1. Read and understand the existing code
2. Make minimal, focused changes
3. Ensure all changes pass linting (automatic via hooks)
4. Run tests before reporting completion (automatic via hooks)
```

**Example: Settings-level hooks for sub-agent lifecycle**

```json
// .claude/settings.json
{
  "hooks": {
    "SubagentStart": [{
      "matcher": "guarded-coder",
      "hooks": [{
        "type": "command",
        "command": "./scripts/create-git-stash.sh"
      }]
    }],
    "SubagentStop": [{
      "matcher": "guarded-coder",
      "hooks": [{
        "type": "command",
        "command": "./scripts/validate-and-format.sh"
      }]
    }]
  }
}
```

#### Building a Multi-Agent Pipeline with Custom Sub-Agents

You can build a custom pipeline by creating several specialized sub-agents and having
the main agent (or a coordinator sub-agent) chain them:

```
.claude/agents/
  ├── researcher.md      # Read-only, explores codebase (model: haiku)
  ├── planner.md         # Read-only, creates implementation plan (model: opus)
  ├── implementer.md     # Full tools, writes code (model: opus)
  ├── reviewer.md        # Read-only, reviews changes (model: sonnet)
  └── test-runner.md     # Bash only, runs tests (model: haiku)
```

Then instruct Claude (via CLAUDE.md or prompts):

```markdown
When implementing features, follow this pipeline:
1. Use the researcher sub-agent to understand the codebase
2. Use the planner sub-agent to create an implementation plan
3. Use the implementer sub-agent to write the code
4. Use the reviewer sub-agent to review the changes
5. Use the test-runner sub-agent to validate
```

#### Restricting Sub-Agent Spawning for Coordinator Agents

When running Claude as a named agent via `claude --agent coordinator`, you can restrict
which sub-agents it can spawn:

```yaml
# .claude/agents/coordinator.md
---
name: coordinator
description: Coordinates work across specialized agents
tools: Agent(researcher, implementer, reviewer), Read, Bash
---

You are a coordinator. Delegate research to the researcher,
implementation to the implementer, and review to the reviewer.
Never implement code directly.
```

The `Agent(researcher, implementer, reviewer)` syntax is an allowlist: only those three
sub-agents can be spawned, and the agent sees only those types in its prompt.
This restriction only applies to agents running as the main thread with
`claude --agent`. In an ordinary sub-agent definition, listing `Agent` in `tools` lets
the sub-agent spawn its own sub-agents up to the depth limit, and the type list in
parentheses is ignored ([sub-agents docs](https://code.claude.com/docs/en/sub-agents),
re-verified 2026-09-16).

#### Limitations of Custom Delegation

1. **No custom delegation logic:** You cannot write code that runs inside Claude Code’s
   delegation decision.
   The delegation is based on Claude’s interpretation of `description` fields — it’s
   LLM-driven, not rule-based.

2. **Limited sub-agent-to-sub-agent communication:** Sub-agents report back to the agent
   that launched them; named sub-agents can also message each other with `SendMessage`
   (v2.1.206+), but there is no shared task list without agent teams.
   *(Corrected 2026-09-16.)*

3. **Bounded nesting:** Sub-agents can spawn their own sub-agents up to three layers
   below the main conversation by default; results flow back to the launcher, not the
   main conversation, so a deep pipeline still needs the coordinator to collect them.
   *(Corrected 2026-09-16; the February 2026 text said nesting was impossible.)*

4. **Hook-based control is limited to shell commands:** Hooks run shell commands and use
   exit codes to allow/block.
   They can’t modify the sub-agent’s prompt or tools dynamically.

5. **No programmatic delegation override:** You can’t write a function that decides
   which sub-agent to use based on custom logic.
   You can only influence the decision via descriptions and deny lists.

#### Workaround: Full Custom Delegation via Outer Loop

For fully custom delegation logic, use the `claude -p` outer loop pattern (Section 7).
The outer Claude Code instance can implement arbitrary delegation logic:

```bash
# Outer orchestrator decides which specialist to invoke
claude -p "Analyze this task and determine the right approach" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"approach":{"enum":["research","implement","debug"]},"reasoning":{"type":"string"}}}'

# Based on the structured output, invoke the right specialist
if [ "$approach" = "research" ]; then
  claude -p "Research: $task" --model haiku --system-prompt "You are a researcher..."
elif [ "$approach" = "implement" ]; then
  claude -p "Implement: $task" --model opus --system-prompt "You are a developer..."
fi
```

This gives you fully custom delegation at the cost of managing the orchestration
yourself.

### 10. Self-Managed Compaction and Agent Self-Restart

This section addresses a fundamental problem: **auto-compaction degrades quality
progressively**, and there is no built-in way for an agent to “kill itself and
rejuvenate” with a clean context window.
We explore every available mechanism for an agent to manage its own context lifecycle.

*(Verification status, 2026-09-16. Re-verified: `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` exists
and applies to sub-agents as well as the main conversation; the `PreCompact` (matchers
`manual` and `auto`), `SessionStart` (matcher `compact` among others), `Stop`,
`SubagentStart`, and `SubagentStop` hook events exist, `prompt`-type hooks are
supported, and a `PostCompact` event now exists too; `/compact` accepts focus
instructions and `/context` works in cloud sessions.
Not re-verified: the ~95% trigger figure and buffer sizes, the status of issue #15174,
the third-party handoff tools in References, and the practitioner cost figures.
Nothing in this section was changed on that basis; treat those details as February 2026
observations.)*

#### The Problem with Auto-Compaction

Built-in auto-compaction triggers at ~95% context capacity.
It uses an LLM call to summarize the conversation, then continues with the summary.
Known problems:

1. **Progressive context loss.** Each compaction summarizes the summary, causing
   exponential detail loss.
   By the 2nd or 3rd compaction, critical decisions, failed approaches, and nuanced
   understanding are typically gone.
2. **Late trigger.** At 95% capacity, model performance is already degraded.
   Practitioners recommend treating 70% as the practical ceiling.
3. **Not task-aware.** Compaction fires purely on token count, not at semantic
   boundaries (e.g., between phases of work).
4. **Infinite compaction loops.** A known bug where Claude Code gets stuck cycling
   between compaction and work.
5. **Buffer overhead.** Claude Code reserves ~33K-45K tokens as buffer, so usable
   context is less than the raw 200K.

**Configuration:**

```json
// Trigger compaction earlier (at 70% instead of ~95%)
{
  "env": {
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "70"
  }
}
```

The `/compact` command also accepts custom focus instructions:
```
/compact focus on the authentication refactoring decisions and failed approaches
```

#### Approach 1: tbd Agent Handoff (Simplest)

The `tbd shortcut agent-handoff` shortcut generates a structured handoff prompt
optimized for the next agent.
It captures:

- Task and spec context
- Current branch, PR, CI status
- tbd issue IDs and statuses
- Failed approaches and key decisions
- Non-obvious setup requirements

**Workflow:**

```
1. Agent detects it's getting long/complex
2. Agent runs: tbd shortcut agent-handoff
3. Output is a structured prompt
4. User pastes it into a new Claude Code session
5. New session starts fresh with full context
```

**Critical pre-handoff step:** Always run `tbd sync` before generating the handoff to
ensure issue state is pushed to the remote.

**Advantage over auto-compaction:** The handoff is curated — it captures *what matters*,
not a generic summary.
Failed approaches (the most valuable information) are explicitly preserved.

#### Approach 2: Outer Loop with `claude -p` (Semi-Autonomous)

The agent spawns a fresh Claude Code instance via the Bash tool.
The current session waits for the subprocess to complete, then continues.

```bash
# Agent writes handoff, then spawns a fresh instance
claude -p "$(cat .handoff/current.md)" \
  --model opus \
  --allowedTools "Bash,Read,Edit,Write,Glob,Grep" \
  --max-turns 30 \
  --max-budget-usd 5.00
```

**Key flags for self-restart:**

| Flag | Purpose |
| --- | --- |
| `-p "prompt"` | Non-interactive mode |
| `--output-format json` | Get session_id, metadata back |
| `--max-turns N` | Prevent runaway (budget the phase) |
| `--max-budget-usd N` | Hard spending cap |
| `--append-system-prompt "..."` | Inject handoff instructions |
| `--system-prompt-file ./prompt.txt` | Full custom system prompt |
| `--session-id UUID` | Control session identity |
| `--no-session-persistence` | Don’t save (for throwaway work) |

**What happens to the current session?** It blocks on the Bash call until the subprocess
finishes, then continues.
The subprocess is fully independent — its own context window, model, permissions.
The old session does NOT terminate itself.

**Can the agent truly “self-restart”?** Not quite — the old session persists and waits.
But the *effective* behavior is the same: work transfers to a fresh context.
To get true self-termination, use the outer loop shell script (Approach 4).

#### Approach 3: Session Chaining with `--continue` and `--resume`

```bash
# Continue most recent session (appends to existing context)
claude -c -p "Now fix the remaining test failures"

# Resume a specific session by ID
claude -r "abc123-def456" -p "Continue from where you left off"

# Fork: new session ID, inherits history up to fork point
claude --resume "abc123" --fork-session
```

**Important distinction:**
- `--continue`/`--resume` **reloads the full conversation history**. This is NOT
  compaction — it carries the full context and can hit `prompt_too_long` errors if the
  session was already near limits.
- **Forking** is useful for trying alternative approaches without losing the original
  session.

**When to use this vs handoff:**
- Use `--continue` when context is still manageable and you want continuity.
- Use a handoff (fresh `-p`) when context is bloated and you want a clean restart with
  curated state.

#### Approach 4: Ralph Loop Shell Script (Fully Autonomous)

The “Ralph Loop” pattern: a shell script runs `claude -p` in a loop, with each iteration
getting a fresh context window.
State persists in the filesystem, not in the model’s memory.

```bash
#!/bin/bash
# ralph-loop.sh — Autonomous compaction via iteration

TASK_FILE=".handoff/task.md"
STATE_FILE=".handoff/state.md"
MAX_ITERATIONS=20

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "=== Iteration $i ==="

  PROMPT="You are iteration $i of $MAX_ITERATIONS.
Read $STATE_FILE for current progress.
Read $TASK_FILE for the overall task.
Do ONE meaningful unit of work, then update $STATE_FILE.
If the task is complete, write DONE as the first line of $STATE_FILE."

  claude -p "$PROMPT" \
    --model opus \
    --allowedTools "Bash,Read,Edit,Write,Glob,Grep" \
    --max-turns 30 \
    --max-budget-usd 3.00

  # Check if done
  if head -1 "$STATE_FILE" 2>/dev/null | grep -q "DONE"; then
    echo "Task completed in $i iterations"
    break
  fi

  # Commit progress between iterations
  git add -A && git commit -m "ralph loop: iteration $i" --no-verify 2>/dev/null
done
```

**Key design principles:**

1. **State lives in files, not context.** The state file is the “memory” that survives
   across iterations. Each iteration reads it, works, updates it.
2. **One unit of work per iteration.** Don’t try to do everything in one pass.
   Let the loop handle continuity.
3. **Git commits between iterations.** Each iteration’s work is preserved in git,
   providing a safety net and audit trail.
4. **Budget limits per iteration.** Prevents any single iteration from running away.

**Overnight batch processing:** A team at a YC hackathon used this pattern to produce
1,100+ commits across six repos overnight for ~$800 ($10.50/hour/agent).

#### Approach 5: Hooks-Based Compaction Management

Use Claude Code hooks to automate parts of the compaction lifecycle.

**Backup context before auto-compaction:**

```json
{
  "hooks": {
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": ".claude/hooks/backup-transcript.sh"
      }]
    }]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/backup-transcript.sh
INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path')
BACKUP_DIR="$CLAUDE_PROJECT_DIR/.handoff/backups"
mkdir -p "$BACKUP_DIR"
cp "$TRANSCRIPT" "$BACKUP_DIR/transcript_$(date +%Y%m%d_%H%M%S).jsonl"
exit 0
```

**Inject handoff context after compaction (unreliable — see caveat):**

**Caveat:** The `SessionStart` hook with `compact` matcher has a
[known bug (Issue #15174)](https://github.com/anthropics/claude-code/issues/15174) — the
hook executes but stdout may not be injected into context after compaction completes.
This means the pattern below may silently fail.
Test in your environment before relying on it, and prefer the `PreCompact` backup
approach above as the more reliable hook-based strategy.

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "compact",
      "hooks": [{
        "type": "command",
        "command": "cat .handoff/current.md 2>/dev/null || echo 'No handoff context'"
      }]
    }]
  }
}
```

**Force handoff before session ends:**

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "prompt",
        "prompt": "Before stopping: update .handoff/current.md with current state, run tbd sync, and commit the handoff file."
      }]
    }]
  }
}
```

#### Approach 6: Git-Based Handoff (Cross-Device, Cross-Agent)

The agent writes handoff state to a git-tracked file, commits, pushes.
Any subsequent session (local, cloud, different machine) picks it up by pulling.

```bash
# Current agent writes handoff and pushes
cat > .handoff/current.md << 'HANDOFF'
# Handoff: OAuth2 Implementation
## Phase: 3/5 — Email Notification Service
### Completed: database models, API endpoints, token validation
### In Progress: email template rendering
### Failed Approaches:
- Session cookies: cross-origin issues with mobile app
- SendGrid API v2: deprecated, had to migrate to v3
### Key Decisions:
- JWT over opaque tokens (client-side validation needed)
### Next Steps:
1. Complete email templates in src/notifications/templates/
2. Wire up frontend form to POST /api/auth/register
HANDOFF
git add .handoff/current.md && git commit -m "handoff state" && git push
```

```bash
# New session (anywhere) picks it up
git pull
claude -p "Read .handoff/current.md and continue the task."
```

**Advantages:** Durable (survives VM teardowns), auditable (git log), works across the
Cloud/local boundary.

**Disadvantage:** Commit noise.
Use a `.handoff/` directory and consider squashing handoff commits later.

#### Approach 7: tbd Handoff Integration (Recommended for This Project)

Combining tbd’s issue tracking with structured handoffs provides the most robust pattern
for our project:

```
1. Agent works on tbd issue(s)
2. Agent detects it's approaching context limits
   (or human decides it's time to hand off)
3. Agent runs: tbd shortcut agent-handoff
4. Agent runs: tbd sync
5. Agent commits any WIP + handoff file
6. Agent pushes
7. New session starts:
   - Reads .handoff/current.md
   - Runs tbd prime (restores full tbd context)
   - Runs tbd ready (sees what issues to work on)
   - Continues implementation
```

This is strictly better than auto-compaction because:
- The handoff is **curated** (not a generic LLM summary)
- Failed approaches are explicitly captured
- tbd issues provide structural continuity across sessions
- Git provides a safety net and audit trail
- Works across Cloud/local boundary

#### Cloud-Specific Considerations

**Can a Cloud session restart itself?** Not directly — a Cloud session cannot spawn a
new Cloud session *(not re-verified 2026-09-16; the cloud page documents starting and
messaging cloud sessions from a terminal, not from inside another cloud session)*.
However:

- The agent can write a handoff file, commit, and push.
  A new Cloud session (started by the user) will see it.
- From local: `claude --cloud "Read .handoff/current.md and continue"` spawns a new
  Cloud session (`--remote` is now a deprecated alias for `--cloud`), and
  `claude -p "message" --cloud <session-id>` queues a follow-up into a running one.
- Teleport (`/tp`) pulls a Cloud session to local, where you have full shell control for
  outer loops.

**For autonomous self-restart in Cloud:** The most practical pattern is to use hooks
(Stop hook forces handoff) + git-based state + human starts a new Cloud session.
True autonomous restart requires local CLI or a shell script runner.

#### Token Budget Awareness

Can an agent detect when it’s approaching context limits?

1. **System-level warnings** are injected into context when token usage is high.
   The format varies but includes remaining token count.
2. **`/context` command** shows current context usage breakdown in interactive mode.
3. **`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`** can be set to 70% to trigger compaction
   earlier, before quality degrades.
   *(Verified 2026-09-16: it accepts 1 to 100, can only lower the threshold, applies to
   sub-agents too, and is set by cloud sessions themselves, which override any value in
   the environment’s variables.)*
4. **Subagents get their own context** — offloading work to sub-agents naturally reduces
   main context pressure.

**There is no programmatic API for an agent to query its own token usage.** The agent
can’t invoke `/compact` programmatically either.
The closest workaround: set `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=70`, configure a
`PreCompact` hook to back up state, and a `SessionStart(compact)` hook to inject the
handoff after compaction.

#### Approach 8: Bead-Managed Loop (Structured Iteration via Issue Tracking)

The most structured variant of the Ralph Loop: use **tbd beads** to track each iteration
as a separate issue, with parent-child relationships providing a clear audit trail and
structured context for the next agent.

**Core idea:** A parent bead represents the overall task.
Each iteration spawns a child bead that captures what happened in that step.
The next iteration reads the chain of completed child beads to understand full history —
without relying on context window memory at all.

**Why this is powerful:**

1. **Each bead is a structured summary.** Not a generic LLM compaction — a deliberate,
   curated record of what was attempted, what worked, what failed.
2. **The chain is the memory.** After 50 restarts, you have 50 beads.
   The next agent reads the recent ones (not all 50) to understand current state and
   trajectory.
3. **Beads survive everything.** Context compaction, session crashes, VM teardowns,
   Cloud/local boundary crossings.
   They’re git-native.
4. **Natural stopping points.** Each bead close is a clean checkpoint.
   If something goes wrong, you can see exactly which iteration introduced the problem.
5. **Dependency tracking.** Child beads can depend on each other sequentially, so
   `tbd ready` naturally surfaces the next step.

**Implementation pattern (shell orchestrator):**

```bash
#!/bin/bash
# bead-loop.sh — Ralph Loop with bead-per-iteration tracking

PARENT_BEAD="$1"  # e.g., "ar-k8m2" — the overall task bead
MAX_ITERATIONS=50
TASK_FILE=".handoff/task.md"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "=== Iteration $i ==="

  # Create a child bead for this iteration
  CHILD_ID=$(tbd create "Iteration $i of: $(tbd show $PARENT_BEAD --json | jq -r '.title')" \
    --type task --priority P2 --json | jq -r '.id')
  tbd dep add "$CHILD_ID" "$PARENT_BEAD"
  tbd start "$CHILD_ID"

  PROMPT="You are iteration $i of up to $MAX_ITERATIONS.

TASK: Read $TASK_FILE for the overall objective.

PREVIOUS ITERATIONS: Run 'tbd show $PARENT_BEAD' to see the parent task,
then check its child beads for history of previous iterations.

YOUR JOB:
1. Read the most recent closed child beads to understand what's been done
2. Do ONE meaningful unit of work toward the objective
3. When done, update bead $CHILD_ID with a clear summary:
   tbd close $CHILD_ID --reason 'Did X. Result: Y. Next: Z.'
4. If the OVERALL task is complete, also close $PARENT_BEAD
5. Run tbd sync"

  claude -p "$PROMPT" \
    --model opus \
    --allowedTools "Bash,Read,Edit,Write,Glob,Grep" \
    --max-turns 30 \
    --max-budget-usd 3.00

  tbd sync

  # Check if parent bead was closed (task complete)
  STATUS=$(tbd show "$PARENT_BEAD" --json | jq -r '.status')
  if [ "$STATUS" = "closed" ]; then
    echo "Task completed in $i iterations"
    break
  fi

  # Commit progress between iterations
  git add -A && git commit -m "bead loop: iteration $i ($CHILD_ID)" --no-verify 2>/dev/null
  git push 2>/dev/null
done
```

**Implementation pattern (tbd-native / future):**

The tbd harness itself could manage the loop, removing the need for a shell script:

```bash
# Hypothetical tbd command (not yet implemented)
tbd loop $PARENT_BEAD \
  --max-iterations 50 \
  --model opus \
  --budget-per-iteration 3.00 \
  --prompt-file .handoff/task.md
```

This would:
1. Create child beads automatically for each iteration
2. Build the prompt from parent bead + recent child bead history
3. Spawn `claude -p` with the constructed prompt
4. Close the child bead with the agent’s summary
5. Check if the parent bead was closed (done) or continue
6. Run `tbd sync` and `git push` between iterations

**What the bead chain looks like after 5 iterations:**

```
ar-k8m2  [open]     "Refactor auth module to use JWT"
  ├── ar-m3n1  [closed]  "Iteration 1: Analyzed current auth code, identified 3 modules"
  ├── ar-p4q2  [closed]  "Iteration 2: Created JWT token service, wrote tests"
  ├── ar-r5s3  [closed]  "Iteration 3: Migrated login endpoint, tests passing"
  ├── ar-t6u4  [closed]  "Iteration 4: Migrated registration endpoint, found edge case"
  └── ar-v7w5  [in_progress]  "Iteration 5: Fix edge case in token refresh"
```

Each closed bead’s `--reason` contains a structured summary: what was done, what the
result was, what should happen next.
This is far richer than auto-compaction’s generic summary.

**Advantages over plain Ralph Loop:**

| Aspect | Plain Ralph Loop | Bead-Managed Loop |
| --- | --- | --- |
| State format | Free-form text file | Structured beads with metadata |
| History | Single state file (overwritten) | Full chain of closed beads |
| Audit trail | Git commits only | Beads + git commits |
| Searchable | `grep` through state file | `tbd search`, `tbd show` |
| Resumable | Read state file | `tbd ready` surfaces next step |
| Cross-agent | Must share file path | `tbd sync` shares everywhere |
| Rollback | `git revert` | Close/reopen beads, `git revert` |
| Visibility | Log file | `tbd list` shows all iterations |

**When to use this vs plain Ralph Loop:**
- Use plain Ralph Loop for quick, low-ceremony autonomous work.
- Use bead-managed loop when you want full traceability, when multiple people/agents
  might inspect progress, or when iterations are complex enough that a one-line state
  file isn’t sufficient.

#### Decision Matrix: Which Approach to Use

| Approach | Complexity | Context Quality | Autonomy | Cloud? | Best For |
| --- | --- | --- | --- | --- | --- |
| `/compact` (built-in) | None | Low-Medium | Automatic | Yes | Quick extension of a session |
| `tbd agent-handoff` | Low | High | Manual | Yes | Structured team/project handoffs |
| `claude -p` from session | Medium | High | Semi-auto | Local only | Agent-initiated fresh start |
| `--continue`/`--resume` | Low | Full (risky) | Manual | Yes | Quick session pickup |
| Ralph Loop script | High | High | Fully auto | Local only | Long autonomous multi-phase work |
| Bead-managed loop | High | Highest | Fully auto | Yes* | Traceable multi-phase with full audit trail |
| Hooks (Pre/Post compact) | Medium | Medium-High | Automatic | Yes | Augmenting auto-compaction |
| Git-based handoff | Medium | High | Semi-auto | Yes | Cross-device, cross-agent work |
| tbd handoff + git | Medium | Highest | Semi-auto | Yes | This project specifically |

\* Bead-managed loop: the shell orchestrator runs locally, but beads sync via git so
progress is visible everywhere.
A tbd-native orchestrator could run in any environment.

### 11. Sub-Agent Workflows as Practiced in tbd

*(Added 2026-09-16.)* This section summarizes how tbd applies the mechanics above.
The normative text is the
[PR Review Lifecycle and Sub-Agent Delegation plan](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md)
(a draft as of 2026-09-16), which is to become the `delegate-to-subagents` and
`review-and-merge-prs` shortcuts and the `agent-model-tiers` and `agent-policy-grants`
guidelines; where this summary and the plan differ, the plan wins.
Vendor citations [V1] to [V16] are defined in the plan’s Vendor Guidance section and
collected in the
[companion brief](research-2026-09-16-subagent-guidance-anthropic-openai.md).

#### Coordinator and Roles

The user’s session is the **coordinator**. It checks out the PR head, records the head
SHA and merge base, owns the beads for the overall request, runs the merge in merge
mode, and never changes the shared tree while a sub-agent works in it.
Delegated roles (plan, Roles):

| Role | Tier | Changes | Publishes |
| --- | --- | --- | --- |
| Reviewer | strong | No commits; may run tests and scratch scripts | One senior engineering review, as a formal GitHub review pinned to the head commit |
| Dedicated reviewer | strong | Same as the reviewer | A security, performance, or correctness review, when the PR is sensitive in that area |
| Addressing agent | moderate | Sole committer on the PR branch; beads | Disposition replies (`fixed`, `rebutted`, `declined`, `deferred`) |
| Administrator | fast | Beads; no code | CI waits, state collection, prepared replies |

Reviewers follow instructions rather than tool restrictions: they may run the test suite
and reproduction scripts, keep scratch files in the session scratch directory, do not
commit or push, and leave the tree as they found it.
The addressing agent escalates to the coordinator for design decisions, before rebutting
or declining a Blocker or High finding, and when two findings conflict.

#### Model Tiers

Tiers are defined by model rank and reasoning level within whatever provider the
platform uses, not by model name (plan, Model Tiers):

- **strong:** the provider’s strongest model at its highest or second-highest reasoning
  level, for reviews, additional review rounds, design decisions, and escalations;
- **moderate:** the next-tier model at its highest or second-highest level, for
  addressing findings and confirming fixes;
- **fast:** the next-tier model at middle levels, for CI waits, state collection, bead
  bookkeeping, and conflict-free rebases.

Selection rules: rank what the platform offers and pick the best match per tier; use the
higher level within a tier for riskier work; with one model, strong and moderate use its
top two levels and fast its middle levels; with no reasoning control, vary only the
model; if the strongest model is unavailable, use the best available, record the
substitution, and tell the user; record the tier, model, and level requested for every
delegated task. The plan’s named examples are suggestions dated 2026-09-16, not
requirements: Fable at `max` or `xhigh` (strong), Opus at `max` or `xhigh` (moderate),
and Opus at `high` or `medium` (fast) on Anthropic; GPT-6 Astra and GPT-5.6 Sol in the
same pattern on OpenAI. They must be updated as the landscape changes.

On Claude Code this maps onto Sections 2 and 3 directly: the model is named on every
spawn (a per-call `model` outranks `CLAUDE_CODE_SUBAGENT_MODEL`), the reasoning level
needs a predefined agent with an `effort` field, and tier work starts in a fresh, named
sub-agent rather than a fork, which would inherit the parent’s model and effort.
The plan proposes that `tbd setup` generate small `.claude/agents/tbd-*.md` definitions,
one per tier and level (proposed: `tbd-strong-max`, `tbd-strong` at `xhigh`,
`tbd-moderate` at `xhigh`, `tbd-fast` at `medium`), refreshed on upgrade so updating tbd
updates the suggestions, plus matching `.codex/agents/tbd-*.toml` files (plan, Tier
Agent Definitions). The coordinator also checks `CLAUDE_CODE_SUBAGENT_MODEL` and
`CLAUDE_CODE_SUBAGENT_MODEL_FORCE`, which can change or block a named model [V1].

#### Authorization: The `subagents` Policy Grant

tbd encourages sub-agents but delegates only under an explicit grant (plan, Policy
Grants and Sub-Agent Authorization).
Grants are recorded in a policy block in `AGENTS.md` (between
`<!-- BEGIN TBD POLICY GRANTS v=1 -->` and `<!-- END TBD POLICY GRANTS -->`), read from
the default branch, preserved by `tbd setup` across upgrades, shown by `tbd prime` and
`tbd policy show`, and validated by `tbd doctor`. Before the first delegation in a task,
the coordinator checks the conversation, then the project block, then a user-level
grant; if `subagents` is not granted and the user’s wishes are unclear, it asks once,
and a request for depth or thoroughness is not authorization [V16]. When the user
authorizes sub-agents, the agent records `subagents: granted` with
`tbd policy grant subagents` and says so; a conversation instruction overrides the
recorded grant for that task.
The same block serves as the explicit authorization Codex requires before spawning
[V13], [V16]. A grant never bypasses a tool permission or sandbox.

#### Self-Contained Briefs

Sub-agents do not share the coordinator’s context (Section 3), so every brief states:
the goal and the shortcut to run (`tbd shortcut <name>`); pinned inputs as paths and IDs
rather than summaries (PR number, head SHA, review letter, working tree path, bead IDs);
the role’s boundaries; the user’s exact authorization and the effective grants, and
nothing broader (a sub-agent never merges unless the merge is authorized and delegated);
and the report fields the coordinator needs (URLs, SHAs, review letters, bead IDs,
dispositions, CI run IDs, changed files), condensed [V12]. Briefs add no “double-check
your work” instructions, because current models verify their own work and extra
instructions cause over-verification [V7]. Addressing agents also receive the
interruption brief from `agent-run-operations-rules`.

#### Verifying Sub-Agent Claims

The coordinator relies on no claim it has not checked (plan, Delegation Procedure step
5; [V2], [V8]): the review exists, carries its `<!-- tbd:review ... -->` marker, and is
bound to the stated commit (`gh api`); the pushed SHA is on the remote
(`git ls-remote`); CI is final and green for that SHA (`gh pr checks`); the disposition
reply lists every finding; and the beads exist (`tbd show`). The report scan described
in Section 3 flags instruction-shaped text in a report but does not judge it, so the
coordinator still treats report contents as data.
If a sub-agent failed, the coordinator reads its transcript before deciding why, then
resumes or replaces it and reports any coverage that is actually missing.
Because a sub-agent cannot reliably report its own model or effort, the review header
records the *requested* tier, model, and level.

#### One Committer per Branch, One Tree by Default

For one PR the reviewer and then the addressing agent work in sequence in the same tree,
which is simpler and faster than a worktree per role; the addressing agent is the sole
committer on the branch, and the coordinator does not touch the tree while a sub-agent
works in it (plan, Pinning and the Working Tree; Delegation Procedure step 2). Dedicated
reviews run in sequence in that tree, or in parallel only in separate worktrees.
A separate worktree or session is used when the user asks for one.
On Claude Code, `isolation: worktree` starts from the default branch, so a worktree
sub-agent must check out the PR branch first (Section 3); bead data lives in
`$GIT_COMMON_DIR/tbd/` and is shared across the worktrees of one clone, and a running
`tbd sync` must never be killed (`tbd-pht1`). The coordinator keeps few sub-agents
running at once, closes finished ones so they stop holding concurrency slots (20 by
default, Section 1), keeps doing local work while they run, and removes a worktree once
its branch is pushed or merged and nothing is uncommitted.

#### Several PRs at Once

The shared tree holds one PR head at a time, so PRs are handled one at a time there.
To work on several at once, each PR gets its own worktree, shared by that PR’s reviewer
and addressing agent.
Merges happen one at a time; after each merge the coordinator re-pins the remaining PRs,
and a base update that needs conflict resolution is a signal for another review round
(plan, Several PRs).

#### Single-Agent Fallback

Without sub-agents (no grant, a platform without them, or a run where delegation is not
wanted), one session performs every step in order with the same artifacts: the same
review header and marker, the same finding IDs and dispositions, the same merge gate.
The header records the session’s actual model and reasoning level, and a review of fixes
the same session wrote says that it is not independent (plan, Single-Agent Fallback).
Vendor guidance supports the fallback when steps chain or share context [V3], [V15].

#### Cross-Platform Note: Codex

The same workflow runs on Codex with different mechanics, summarized here from the
plan’s Platform Facts table; the
[companion brief](research-2026-09-16-subagent-guidance-anthropic-openai.md) holds the
sourced detail and each fact’s re-verification status.
Codex spawns with `spawn_agent`, which takes `model` and `reasoning_effort` per spawn
(so tier definitions are a convenience there, not a requirement), while a full-history
fork rejects both overrides; custom agents live in `.codex/agents/*.toml` with `model`,
`model_reasoning_effort`, `developer_instructions`, and `sandbox_mode`; sub-agents share
the parent’s checkout, so parallel PRs need a `git worktree` per PR created by the
coordinator; and Codex spawns only when the user, `AGENTS.md`, or a skill explicitly
asks, which the recorded `subagents` grant satisfies.
A coordinator delegates within its own platform; cross-provider delegation is a non-goal
of the plan.

* * *

## Recommendations

### For Most Workflows: Use Native Sub-Agents with Explicit Models

*(Updated 2026-09-16.)*

1. Name the model on every spawn, or in the definition, and add `effort` to the
   definition when the reasoning level matters; treat `CLAUDE_CODE_SUBAGENT_MODEL` as a
   fallback unless `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` is set deliberately
2. Create custom sub-agents in `.claude/agents/` for project-specific specializations
   (for tbd, the tier agents in Section 11)
3. Name sub-agents you expect to continue, and resume them with `SendMessage` rather
   than starting fresh
4. Preload skills for domain knowledge injection
5. Verify what sub-agents report against GitHub, git, CI, and beads (Section 11)

### For Complex Multi-Phase Projects: Consider the Outer Loop

When you need:
- Custom compaction cycles (better than auto-compaction)
- Arbitrary nesting depth
- Per-phase model selection
- Explicit handoff documents
- Budget limits per phase

The `claude -p` outer loop pattern provides maximum control at the cost of higher
complexity and latency.

### For Collaborative Multi-Agent Work: Use Agent Teams

When workers need to communicate with each other (not just report to parent), agent
teams provide native coordination.
But they’re experimental and have higher token costs.

### Quick-Reference: One Model Everywhere

*(Rewritten 2026-09-16 for the post-v2.1.251 precedence; `opus` is used as the example,
`fable` works the same way.)*

```bash
# Option 1: Environment variables (blanket override needs the force flag)
export ANTHROPIC_MODEL=opus
export CLAUDE_CODE_SUBAGENT_MODEL=opus
export CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1
claude

# Option 2: Settings file (persistent)
# .claude/settings.json or ~/.claude/settings.json
{
  "model": "opus",
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "opus",
    "CLAUDE_CODE_SUBAGENT_MODEL_FORCE": "1"
  }
}

# Option 3: Disable the remaining fixed-model built-in (claude-code-guide is Haiku)
{
  "permissions": {
    "deny": ["Agent(claude-code-guide)"]
  }
}

# Option 4: Per-session CLI flag
claude --model opus --effort xhigh
# (sub-agents that inherit follow the session model and effort;
#  Explore inherits since v2.1.198; a spawn or definition that
#  names a model keeps it unless the force flag is set)
```

* * *

## Next Steps

*(Updated 2026-09-16.)*

- [ ] Revisit this project’s `.claude/settings.json`: it still pins
  `CLAUDE_CODE_SUBAGENT_MODEL` to `claude-opus-4-6` (added 2026-02-13), which since
  v2.1.251 applies only to spawns that name no model and then runs them on an older
  Opus. Either drop it, switch it to an alias, or decide deliberately whether the force
  flag is wanted (it would block the per-spawn models the tbd plan relies on)
- [x] Add `CLAUDE_CODE_SUBAGENT_MODEL` to this project’s `.claude/settings.json` (done
  2026-02-13; see the item above)
- [ ] Ship the tier agent definitions and the `delegate-to-subagents` and
  `review-and-merge-prs` shortcuts from the plan (Section 11), then record what the
  Phase 3 validation runs show about requested versus actual models
- [ ] Prototype the Ralph Loop script for this project (using tbd handoff)
- [ ] Test `PreCompact` and `SessionStart(compact)` hooks for context backup
- [ ] Evaluate token cost impact of running all sub-agents on the strongest model
- [ ] Create project-specific custom sub-agents for common tasks
- [ ] Configure Stop hook to force handoff before session ends
- [ ] Experiment with agent teams for collaborative debugging workflows
- [ ] Re-verify the Section 10 details marked as not re-verified (compaction trigger
  figures, issue #15174, third-party handoff tools)

* * *

## References

### Official Claude Code Documentation

- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) — Complete
  sub-agent configuration reference

- [Model configuration](https://code.claude.com/docs/en/model-config) — Model aliases,
  environment variables, and settings

- [CLI reference](https://code.claude.com/docs/en/cli-reference) — All CLI flags
  including `--model`, `--agents`, `--system-prompt`

- [Settings](https://code.claude.com/docs/en/settings) — Configuration scope hierarchy
  and environment variables

- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)
  — Agent teams reference (experimental)

- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) — Agent
  SDK and `claude -p` usage

- [Common workflows](https://code.claude.com/docs/en/common-workflows) — Workflow
  patterns including parallel sessions with git worktrees

- [Hooks](https://code.claude.com/docs/en/hooks) — Lifecycle hooks including
  SubagentStart/SubagentStop events

- [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web) —
  Cloud environment configuration including environment variables

- [Manage Claude’s memory](https://code.claude.com/docs/en/memory) — Context management,
  compaction, and `/compact` command

- [Slash commands](https://code.claude.com/docs/en/slash-commands) — `/compact`,
  `/context`, `/model`, `/agents`, `/status` commands

Added 2026-09-16:

- [Run agents in parallel](https://code.claude.com/docs/en/agents): sub-agents, agent
  view, agent teams, and dynamic workflows compared
- [Environment variables](https://code.claude.com/docs/en/env-vars): sub-agent depth and
  concurrency caps, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`
- [Tools reference](https://code.claude.com/docs/en/tools-reference): the Agent tool and
  the availability of the task-tracking tools (`TaskCreate` and friends)
- [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees):
  `isolation: worktree` enforcement and base branch
- [Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging)
- [Orchestrate dynamic workflows](https://code.claude.com/docs/en/workflows)
- [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents) and the
  [migration guide](https://code.claude.com/docs/en/agent-sdk/migration-guide) from the
  Claude Code SDK packages

### Compaction and Handoff Patterns

- [The Ralph Loop](https://awesomeclaude.ai/ralph-wiggum) — Foundational outer-loop
  pattern for autonomous multi-iteration work
- [Smart Handoff for Claude Code](https://blog.skinnyandbald.com/never-lose-your-flow-smart-handoff-for-claude-code/)
  — Custom compact message + WORKING.md pattern
- [Continuous-Claude-v3](https://github.com/parcadei/Continuous-Claude-v3) —
  Ledger-based persistence with handoffs and TLDR analysis
- [claude-handoff plugin](https://github.com/willseltzer/claude-handoff) — Emphasizes
  documenting failed approaches in handoffs
- [claude-code-handoff](https://github.com/nlashinsky/claude-code-handoff) — JSON-based
  machine-readable handoff format
- [Self-checkpoint feature request (Issue #21776)](https://github.com/anthropics/claude-code/issues/21776)
  — Proposed but closed as duplicate
- [SessionStart hook bug with compact matcher (Issue #15174)](https://github.com/anthropics/claude-code/issues/15174)
  — Hook executes but stdout not injected after compaction
- [Context backups: beat auto-compaction](https://claudefa.st/blog/tools/hooks/context-recovery-hook)
  — PreCompact hook for transcript backup

### Anthropic Research

- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
  — Anthropic’s internal orchestrator-worker pattern (Opus lead + Sonnet workers)

### Agent SDK

- [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — Python
  and TypeScript SDK for programmatic Claude Code usage
- [Streaming output](https://platform.claude.com/docs/en/agent-sdk/streaming-output) —
  Real-time streaming with callbacks
- [Structured outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs)
  — JSON schema validation for agent output

### Related Internal Research

- [Sub-agent guidance from Anthropic and OpenAI](research-2026-09-16-subagent-guidance-anthropic-openai.md):
  cross-vendor platform facts and vendor guidance, sources [V1] to [V16]
- [PR Review Lifecycle and Sub-Agent Delegation](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md):
  the plan summarized in Section 11
- [Running Claude Code Across Environments](../archive/research-running-claude-code.md)
  — Multi-agent orchestration landscape survey
- [Agent Coordination Kernel](../archive/research-agent-coordination-kernel.md) —
  UNIX-like primitives for agent coordination

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
