# Research: Sub-Agents in Claude Code and Codex: Mechanics, Vendor Guidance, and Practice

**Date:** 2026-02-13 (last updated 2026-09-18)

**Author:** Joshua Levy, with Claude (Opus 5 and Fable 5.1) and research sub-agents

**Status:** In Progress; maintained as backing research for the plan below.
The Claude Code facts were re-verified on 2026-09-16 against the live documentation;
passages that could not be re-verified carry a dated note rather than a silent change.
The Codex and OpenAI facts were re-verified on 2026-09-17 against the Codex and OpenAI
documentation and the openai/codex source at commit `b0659c53`; corrections are noted
where they were made.
OpenAI prompt-caching figures (retention, write/read multipliers, `prompt_cache_key`,
and reasoning-effort invalidation) were re-read on 2026-09-18 [V42], [V46].

**Related:**

- [PR review lifecycle, policy grants, and sub-agent delegation plan](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md):
  the plan that defines tbd’s roles, model tiers, policy grants, and delegation
  procedure
- [Agent runtimes, session identity, and linkage](research-2026-08-19-agent-runtimes-and-session-linkage.md):
  where agent runs execute and how outside systems address and observe them
- [Claude Code sub-agents research (archived)](../archive/research-claude-code-sub-agents.md):
  the February 2026 Claude Code brief that this document absorbed on 2026-09-16
- [Running Claude Code across environments (archived)](../archive/research-running-claude-code.md)
  and
  [Claude Code orchestration interfaces and UIs (archived)](../archive/research-claude-code-orchestration-and-uis.md):
  the multi-agent ecosystem and control-protocol surveys
- [Agent coordination kernel (archived)](../archive/research-agent-coordination-kernel.md)

## Overview

tbd’s plan for PR review workflows and sub-agent delegation needs current facts about
how coding agents delegate to sub-agents, and what the model vendors recommend.
This document collects that research for the two platforms tbd generates setup surfaces
for, Claude Code (Anthropic) and Codex (OpenAI), so the plan and the shortcuts built
from it can cite one maintained source.

It has two lineages.
The Claude Code material (architecture, model selection, context flow, environments,
orchestration patterns, the Agent SDK, hooks, and compaction) was written in February
2026 as a standalone brief and re-verified in September 2026; where behavior changed in
between (model precedence, nesting, background tool sets, the Explore model, the
`effort` field, forks, the `/agents` command), the text describes the current behavior
and names the version that changed it.
The cross-vendor material (platform mechanics, current models and reasoning levels,
vendor guidance, and what the system prompts say) was researched on 2026-09-16. The two
were consolidated into this document on 2026-09-16.

**Maintenance.** Platform mechanics, model names, and reasoning levels change quickly.
Every fact here is dated.
Re-verify a source before relying on it, update its verification mark, and update the
dated model suggestions in the `agent-model-tiers` guideline when a provider’s lineup
changes. Citation numbers [V1] through [V22] are shared with the plan and must not be
renumbered; a new source takes the next free number.

## Questions to Answer

1. How do Claude Code sub-agents work, what models do they use, and how does a parent
   agent choose a sub-agent’s model and reasoning effort on Claude Code and on Codex?
2. How does context transfer between parent and sub-agent, and what do forks change?
3. Are there differences across environments (CLI, IDE, desktop, cloud)?
4. What do Anthropic and OpenAI recommend about when to delegate, how many sub-agents to
   run, what to put in a brief, and how to verify results?
5. What do the platforms’ system prompts and tool descriptions tell models about
   delegation?
6. Which current models and reasoning levels correspond to tbd’s strong, moderate, and
   fast tiers?
7. Can sub-agents be orchestrated in loops or more complex patterns, and how does Claude
   Code invoking Claude Code compare to native sub-agents?
8. How can a custom delegation framework be built, and how can an agent manage its own
   compaction with a handoff instead of relying on auto-compaction?
9. Where does vendor guidance support or differ from tbd’s plan, and how does tbd apply
   these findings?

## Scope

**Included:** Claude Code’s built-in sub-agent system (the Agent tool, formerly Task),
custom sub-agents, agent teams, headless mode (`claude -p`), the Claude Agent SDK,
hooks, compaction and handoff patterns, and model configuration across environments;
Anthropic’s effort and prompting docs and engineering posts; Codex (CLI, app, IDE
extension) sub-agents and configuration, the open-source Codex prompts and tool
definitions, OpenAI’s reasoning and multi-agent API docs, and the OpenAI Agents SDK.

**Excluded:** other providers and agent platforms (tbd’s tiers apply to them by
principle); cross-provider delegation; third-party orchestrators (Gas Town, Claude
Squad, and the like) and control protocols, which the agent runtimes brief covers; MCP
server architecture; Anthropic API-level multi-agent patterns outside Claude Code.

## Findings

### Platform Mechanics (as of 2026-09-16)

The Claude Code rows were checked against the documentation on 2026-09-16. The Codex
rows were re-verified on 2026-09-17 against the Codex documentation [V13] and the
openai/codex source at commit `b0659c53` [V16]; the last stable release, rust-v0.154.0
(2026-09-09), applies the same spawn rules.

| Capability | Claude Code | Codex |
| --- | --- | --- |
| Spawn mechanism | Agent tool: `subagent_type` (required), `model`, `name`, `run_in_background`, optional `isolation: worktree` [V1] | `spawn_agent` tool. V1 (`features.multi_agent`, on by default) takes `message` or `items`, `agent_type`, `fork_context`, `model`, and `reasoning_effort`; V2 (`features.multi_agent_v2`, off by default in config and chosen per model by the model catalog) requires `task_name` and `message`, replaces `fork_context` with `fork_turns` (`none`, `all`, or a number; `all` when omitted), and rejects `fork_context` [V16] |
| Forked context | A fork inherits the parent’s history, model, tools, and output style and ignores the definition’s `model` and `tools` [V1] | A full-history fork carries the parent’s history. The runtime applies `model` and `reasoning_effort` on forks in both versions and, since PR #37252, `agent_type` on V2 forks (V1 rejects `agent_type` on a fork); the V2 instructions still say full-history forks do not accept overrides (openai/codex#20077, open) [V16], [V38] |
| Model per spawn | Yes; aliases such as `fable` and `opus`, or full IDs [V1] | Yes, from the models the session lists; an unknown name is rejected with the available names, and a spawn without a model takes `agents.default_subagent_model`, then the parent’s model [V13], [V16] |
| Effort per spawn | **No.** Only from the agent definition’s `effort` field or the session’s effort level [V1] | Yes; validated against the model’s supported levels; a `model` without an effort takes that model’s default; without either, `agents.default_subagent_reasoning_effort`, then the parent’s effort [V13], [V16] |
| Effort levels | `low`, `medium`, `high`, `xhigh`, `max`, model-dependent [V6] | Docs disagree: the subagents page lists `low`, `medium`, `high`, `xhigh`, `max`, `ultra`; the config reference lists `minimal` through `xhigh`; the source accepts `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`, and `persistent`, and the model catalog decides which levels each model supports [V13], [V16] |
| Predefined agents | `.claude/agents/*.md` (project), `~/.claude/agents/` (user), or `--agents` JSON on the CLI; plugins can ship them, skills cannot [V1] | `.codex/agents/*.toml` (project) or `~/.codex/agents/`; required `name`, `description`, `developer_instructions`; any other config key such as `model`, `model_reasoning_effort`, `sandbox_mode`, `mcp_servers`, `skills.config`; built-ins `default`, `worker`, `explorer` [V13] |
| Definition reload | Edits load within a few seconds; the first file in a new `agents/` directory, directories added with `--add-dir`, and sessions started with `--disable-slash-commands` need a restart [V1] | Not established |
| Working copy | Shared by default; `isolation: worktree` creates a worktree from the default branch, removed automatically if unchanged [V1] | Shared in both tool versions: the child config copies the parent turn’s `cwd`, approval policy, and permission profile, and nothing creates a worktree; the V1 tool description’s “forked workspace” is prompt wording with no mechanism in the local CLI [V16] |
| Nesting and concurrency | Default depth 3 and 20 concurrent sub-agents, both configurable [V1] | V1: depth 1 (`agents.max_depth`, undocumented) and 6 threads (`agents.max_concurrent_threads_per_session`); V2: `max_depth` ignored, and 4 concurrency slots including the root (`features.multi_agent_v2.max_concurrent_threads_per_session`, or `agents.max_concurrent_threads_per_session` plus one) [V13], [V16] |
| Model overrides from the environment | `CLAUDE_CODE_SUBAGENT_MODEL` applies when no model is named; `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` overrides named models too [V1] | `[agents]` defaults apply when the spawn names none; a custom agent file’s `model` and `model_reasoning_effort` override the spawn values [V13], [V16] |
| Background sub-agents | The default in interactive sessions; a reduced set of built-in tools, MCP tools kept [V1] | Not applicable |
| Report handling | The final report is scanned: imitations of Claude Code output get a backslash, and instruction-shaped text or permission-setting mentions get a leading `[harness: ...]` line; nothing is removed or reworded [V1] | Not established |
| Permissions | Background sub-agents inherit the permission mode and surface their prompts in the main session [V1] | Sub-agents inherit the sandbox and approval policy and the parent turn’s live overrides (`/permissions`, `--yolo`), even over a custom agent file’s defaults; a new approval in a non-interactive run fails back to the parent [V13] |

### Claude Code: Sub-Agent Architecture

*(Re-verified 2026-09-16 against the sub-agents docs [V1].)*

Claude Code’s sub-agent system works through the **Agent tool** (renamed from the Task
tool in v2.1.63; `Task(...)` still works as an alias in permission rules), which spawns
specialized assistants for specific kinds of task.
Each sub-agent runs in its **own context window** with a custom system prompt, specific
tool access, and independent permissions.
When Claude encounters a task matching a sub-agent’s description, it delegates to that
sub-agent, which works independently and returns a result.

**Nesting and concurrency.** The February 2026 version of this research said sub-agents
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
sessions with ultracode active are exempt [V1], [V26]. Version history: nesting up to 5
layers in v2.1.172 through v2.1.216 (not configurable), default 1 in v2.1.217 and
v2.1.218, default 3 from v2.1.219. A nested sub-agent can message the agent that
launched it, and its results go back to that launcher, not to the main conversation.

#### Built-in Sub-Agent Types

| Sub-agent | Default model | Tools | Purpose |
| --- | --- | --- | --- |
| **Explore** | Inherits from the main conversation, capped at Opus on the Claude API (v2.1.198+) | Read-only; Write and Edit denied | File discovery, code search, codebase exploration |
| **Plan** | Inherits | Read-only; Write and Edit denied | Codebase research for plan mode |
| **General-purpose** | `CLAUDE_CODE_SUBAGENT_MODEL` if set, otherwise the main model | Every tool available to sub-agents | Complex research, multi-step operations, code modifications |
| **claude** | None of its own; the normal resolution order when Claude spawns it as a sub-agent | Every tool available to sub-agents | Catch-all for tasks that fit no specialized agent |
| **statusline-setup** | Sonnet | Read, Edit (February 2026 listing) | Configuring the status line via `/statusline` |
| **claude-code-guide** | Haiku | Glob, Grep, Read, WebFetch, WebSearch (February 2026 listing) | Answering questions about Claude Code features |

Source: [V1]. Notes, 2026-09-16: the page no longer lists tools for the last two rows,
so the February 2026 tool lists are kept as given.
The February 2026 table also listed a “Bash” built-in that inherited the model and ran
terminal commands in a separate context; it no longer appears on the page.

**What changed since February 2026.** Explore then always ran on Haiku, so the most
common delegation (codebase exploration) ran on a smaller model unless overridden.
As of v2.1.198 Explore inherits the main conversation’s model, and built-in Explore and
Plan are one-shot: they return no agent ID and cannot be resumed.
Only `claude-code-guide` (Haiku) and `statusline-setup` (Sonnet) still run on fixed
smaller models. `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` (v2.1.198+) removes Explore
and Plan entirely so Claude reads and explores directly.
Explore and Plan also skip every `CLAUDE.md` and the git status snapshot that other
sub-agents receive (see Context Transfer and Forks).

### Models and Reasoning Effort

#### Claude Code Model Resolution

*(Re-verified 2026-09-16. The February 2026 order, with `CLAUDE_CODE_SUBAGENT_MODEL`
first and the rest inferred, was correct before v2.1.251 and is now documented and
different.)*

Since v2.1.251 Claude Code resolves a sub-agent’s model in this order [V1]:

1. **Per-invocation `model` parameter on the Agent tool.** The parent passes an alias
   (`fable`, `opus`, `sonnet`, `haiku`) or a full model ID. Since v2.1.211 the value
   also applies when the sub-agent is resumed or messaged, so it stays on that model.
2. **Per-sub-agent `model` field** in the definition’s frontmatter; `inherit` (the
   default when omitted) selects the main conversation’s model.
3. **`CLAUDE_CODE_SUBAGENT_MODEL`**, when set to an alias or model ID. It is the default
   for sub-agents, agent team teammates, and workflow agents that are not assigned a
   model another way [V23]. Since v2.1.196, setting it to `inherit` is the same as
   leaving it unset.
4. **The main conversation’s model.**

So the environment variable is a fallback, not an override.
Two overrides sit outside this order:

- **`CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`** (v2.1.257+) makes every sub-agent, teammate,
  and workflow agent use `CLAUDE_CODE_SUBAGENT_MODEL` (or the main model when that is
  unset), ignoring definitions and per-call values, Explore and Plan included; Claude
  then cannot pass a model when it starts a sub-agent [V1].
- **Organization `availableModels` allowlists.** A blocked family alias such as `opus`
  is replaced by the newest allowed model of that family (on the Anthropic API and
  Claude Platform on AWS); any other blocked value falls back to the inherited model, or
  to `CLAUDE_CODE_SUBAGENT_MODEL` if set [V1].

Accepted values for the `model` field: `sonnet`, `opus`, `haiku`, `fable`, a full model
ID such as `claude-opus-5`, or `inherit` [V1].

**A trap in this repository.** `.claude/settings.json` pins `CLAUDE_CODE_SUBAGENT_MODEL`
to `claude-opus-4-6`, added in February 2026 when the variable overrode everything.
Today it applies only to spawns that name no model in the call or the definition, and it
then runs them on an older Opus than the `opus` alias resolves to.
The plan flags the same trap in the `trading` repository; see Next Steps.

#### Reasoning Level (`effort`) in Claude Code

*(Added 2026-09-16.)* Effort is set per definition or per session, never per spawn.
The `effort` frontmatter field overrides the session effort level for that sub-agent and
accepts `low`, `medium`, `high`, `xhigh`, and `max`; the available levels depend on the
model (Fable 5.1, Fable 5, Opus 5, Sonnet 5, Opus 4.8, and Opus 4.7 accept all five;
Opus 4.6 and Sonnet 4.6 have no `xhigh`) [V1], [V23]. The Agent tool has no effort
parameter, so a sub-agent without an `effort` field inherits the session level, which
comes from `CLAUDE_CODE_EFFORT_LEVEL`, `--effort`, `/effort`, the `effortLevel` or
`modelSettings` settings, or the model’s default (`high` on most models).
Agent team teammates always inherit the lead’s effort level.
`/tasks` shows each sub-agent’s model and effort (v2.1.242+). This is why tbd’s plan
proposes one predefined agent per tier and reasoning level (see How tbd Applies These
Findings).

#### Putting Every Sub-Agent on One Model

*(Rewritten 2026-09-16; the February 2026 title was “How to Force Opus on All
Sub-Agents”, and its Method 1 no longer works on its own.)*

**Method 1: the environment variable plus the force flag (blanket override).** On its
own, `CLAUDE_CODE_SUBAGENT_MODEL` is only a default for spawns that name no model.
Add `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` (v2.1.257+) to override definitions and
per-call values as well [V1]. Set both as real environment variables before launching
`claude`, or in the `env` field of a settings file, which applies to every session and,
in a committed `.claude/settings.json`, travels with the repository to every environment
including cloud sessions [V24]:

```json
// .claude/settings.json (any scope; commit the project copy)
{
  "model": "opus",
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "opus",
    "CLAUDE_CODE_SUBAGENT_MODEL_FORCE": "1"
  }
}
```

Prefer an alias (`opus`, `fable`) to a pinned ID unless you want to stay on an older
model after the alias moves.
The force flag also blocks the per-spawn models that tiered delegation relies on, so set
it deliberately.

**Method 2: custom sub-agents with explicit model and effort.** Create definitions in
`~/.claude/agents/` or `.claude/agents/` with `model` and, when the reasoning level
matters, `effort` [V1]:

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

**Method 3: CLI-defined sub-agents** for one session [V1]:

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

**Method 4: disable specific built-in sub-agents.** A permission rule (`Agent(...)` is
the current syntax; `Task(...)` still works as an alias) or
`claude --disallowedTools "Agent(Explore)"` prevents Claude from using a built-in or
custom sub-agent, so it uses General-purpose instead [V1]:

```json
{ "permissions": { "deny": ["Agent(claude-code-guide)"] } }
```

The February 2026 motivation (Explore ran on Haiku) no longer applies, since Explore now
inherits the main model; the remaining fixed-model built-ins are `claude-code-guide`
(Haiku) and `statusline-setup` (Sonnet).
`CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` (v2.1.198+) removes Explore and Plan without
a permission rule, and denying the `Agent` tool itself stops all delegation.

**Method 5: the session flags.** `claude --model opus --effort xhigh` sets the session
model and effort; sub-agents that inherit follow both (Explore included since v2.1.198),
while a spawn or definition that names a model keeps it unless the force flag is set
[V27].

#### Model Aliases and Environment Overrides

*(Table re-verified 2026-09-16 [V23]; the February 2026 table had `opus` at Opus 4.6 and
`sonnet` at Sonnet 4.5 and did not list `fable` or `best`.)*

| Alias | Resolves to (Anthropic API, 2026-09-16) |
| --- | --- |
| `default` | Clears the override; the account type’s default (below) |
| `best` | `fable` where available, otherwise `opus` |
| `fable` | Fable 5.1 (Fable 5 through the Claude apps gateway); the top tier above Opus |
| `opus` | Opus 5 (Opus 4.6 on Microsoft Foundry) |
| `sonnet` | Sonnet 5 (Sonnet 4.6 on Claude Platform on AWS; 4.5 on Bedrock, Google Cloud, and Foundry) |
| `haiku` | Latest Haiku |
| `opus[1m]`, `sonnet[1m]` | The same models with a 1M-token context window |
| `opusplan` | Opus in plan mode, Sonnet for execution |

To pin a specific version, use the full model ID (for example `claude-opus-5`).
Environment variables override the aliases [V23]:

| Environment variable | Overrides |
| --- | --- |
| `ANTHROPIC_DEFAULT_FABLE_MODEL` | `fable` (also the ID recognized as a Fable model for fallback on third-party providers) |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `opus` (and `opusplan` plan mode) |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `sonnet` (and `opusplan` execution) |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `haiku` (and background functionality; replaces the deprecated `ANTHROPIC_SMALL_FAST_MODEL`) |
| `ANTHROPIC_DEFAULT_MODEL` | The default for new sessions (v2.1.236+); ignored if set to `default`, `inherit`, `opusplan`, or `haiku` |

#### Default Model by Account Type, and Fallback

*(Table re-verified 2026-09-16 [V23]; the February 2026 table listed Opus 4.6
throughout.)*

| Account type | Default model (2026-09-16) |
| --- | --- |
| Max, Team Premium, Enterprise, Anthropic API | Opus 5 |
| Pro, Team Standard | Sonnet 5 |
| Claude Platform on AWS, Amazon Bedrock, Google Cloud Agent Platform | Opus 5 |
| Microsoft Foundry | Sonnet 4.5 |

An organization default model (v2.1.196+) replaces these when an admin sets one.

**Fallback.** The February 2026 text said Claude Code may fall back to Sonnet at a usage
threshold; that is not on the model-config page as of 2026-09-16 and could not be
re-verified. What the page documents [V23]:

- **Availability fallback:** `--fallback-model sonnet,haiku` or a `fallbackModel` list
  in settings switches models when the primary is overloaded or returns a non-retryable
  server error. When a sub-agent’s request fails over (v2.1.247+), the sub-agent
  continues on the fallback model and the session’s model is unchanged.
- **Content-based fallback:** safety classifiers can move a Fable 5.x or Opus 5 request
  to an older model for flagged categories; the session then stays on that model until
  `/model` is run.

Either kind can put strong-tier work on a weaker model without the coordinator noticing,
one reason the tbd plan records the requested tier rather than trusting a sub-agent’s
self-report.

#### Current Models and Reasoning Levels

**Anthropic.**

- The `fable` alias is the most capable model and ranks above `opus` [V1], [V6], [V23].
- Effort levels are `low`, `medium`, `high`, `xhigh`, and `max`; not every model that
  supports `max` supports `xhigh` [V6].
- `high` is the default and the recommended starting point for Fable 5.1 and Opus 5.
  Step up to `xhigh` or `max` for the most capability-sensitive agentic and coding work,
  and down to `medium` or `low` for routine work once evaluations show quality holds
  [V6].
- The effort table lists `low` for simple tasks “such as subagents” [V6].
- Opus 5 review accuracy holds at lower effort [V7].

**OpenAI** (re-read 2026-09-17):

- GPT-6 Astra (`gpt-6-astra`) is OpenAI’s most capable model, for the hardest end-to-end
  work; it runs in the Codex CLI, app, and IDE extension but not Codex cloud, and
  supports `low`, `medium`, `high`, `xhigh`, and `max` but not `none` [V17], [V18].
- The GPT-5.6 family ranks below it: Sol (`gpt-5.6-sol`, the most capable GPT-5.6
  model), Terra (balanced), and Luna (fast and inexpensive).
  In the API, `gpt-5.6` routes to Sol, and Sol supports `none`, `low`, `medium` (the
  default), `high`, `xhigh`, and `max`; of the four, only Sol runs in Codex cloud [V17].
  The subagents page suggests `gpt-5.6` for demanding agents and `gpt-5.6-terra` or
  `gpt-5.6-luna` for lighter sub-agent work [V13].
- In Codex, `model_reasoning_effort` sets the level; the app’s “Extra High” is `xhigh`,
  `max` spends more time on one task, and `ultra` also uses sub-agents in parallel;
  `ultra` is limited to eligible accounts and supported models, and in the source it is
  the level at which V2 switches from explicit-request-only to proactive delegation
  [V13], [V16], [V17].
- GPT-5.5 retires from Codex for ChatGPT sign-in on 2026-10-14, replaced by
  `gpt-5.6-sol` [V17].

**Mapping to tbd’s tiers** (suggestions as of 2026-09-16):

| Tier | Definition | Anthropic example | OpenAI example |
| --- | --- | --- | --- |
| strong | Strongest model from the provider, highest or second-highest level | Fable at `max` or `xhigh` | GPT-6 Astra at `max` or `xhigh` |
| moderate | Next-tier model, highest or second-highest level | Opus at `max` or `xhigh` | GPT-5.6 Sol at `max` or `xhigh` |
| fast | Next-tier model, middle levels | Opus at `high` or `medium` | GPT-5.6 Sol at `high` or `medium` |

### Context Transfer and Forks

#### What a Claude Code Sub-Agent Receives

*(Re-verified 2026-09-16 against the sub-agents docs [V1]. The February 2026 list
omitted `CLAUDE.md` and said background sub-agents lose MCP tools; both corrected
below.)*

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
- Preloaded **skills** content, for a custom sub-agent with a `skills` field; built-ins
  preload none
- The contents of its **memory directory**, if persistent memory is enabled
- A **sibling roster** (v2.1.206+) naming `main` and every named agent in the session,
  when the sub-agent has `SendMessage` and at least one other agent has a name

A non-fork sub-agent does **not** receive:

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
an error instead of spawning [V1]. The user starts one with `/subtask`; Claude also
spawns forks itself where **fork mode** is on, which it is by default in an interactive
session and off under `-p` and in the Agent SDK unless turned on.
With fork mode on, Claude Code runs every sub-agent in the background, forks and
non-forks alike, and Claude cannot ask for the foreground [V1]. For tiered work this
matters: a fork cannot be given a different model or effort, so tier work must start in
a fresh, named sub-agent.

#### Customizing Context Transfer

**Via the `prompt` parameter:** the primary mechanism.
The parent writes a detailed prompt describing the task, and this becomes the
sub-agent’s initial instruction; its quality determines how well the sub-agent
understands what to do.

**Via skills preloading:** the `skills` field in a definition injects full skill content
into the sub-agent’s context at startup:

```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---
```

**Via persistent memory:** the `memory` field gives a sub-agent a directory that
survives across conversations, with scopes `user` (`~/.claude/agent-memory/`), `project`
(`.claude/agent-memory/`), and `local` (`.claude/agent-memory-local/`):

```yaml
---
name: code-reviewer
description: Reviews code quality
memory: user  # or: project, local
---
```

**Via resuming (now `SendMessage`, not a `resume` parameter):** resuming a sub-agent
continues it with its full previous context, including all previous tool calls, results,
and reasoning; this is the most powerful way to maintain continuity.
*(Updated 2026-09-16.)* The February 2026 text described a `resume` parameter on the
Task tool; the current docs describe resuming by sending the finished sub-agent a
message with the `SendMessage` tool, using its agent ID or name as `to`. The sub-agent
resumes in the background without a new Agent call, keeps the tool set from its first
run, keeps the prompt cache it warmed, and (v2.1.211+) stays on any per-invocation
`model`. `SendMessage` does not require agent teams.
Built-in Explore and Plan return no agent ID and cannot be resumed; a sub-agent stopped
with `TaskStop` can be resumed once its run has exited [V1]. Since v2.1.199,
`SendMessage` refuses to deliver to a name that a newer agent has taken over.
Give a sub-agent a `name` at spawn when you expect to come back to it.

#### Limitations of Context Transfer

*(Items 3 and 4 corrected 2026-09-16.)*

1. Sub-agents do not inherit skills from the parent; list them explicitly.
2. Sub-agents do not inherit the full Claude Code system prompt.
3. Background sub-agents surface every permission prompt in the main session
   (v2.1.186+); before that they auto-denied any call that would have prompted.
   A lasting answer (for example a grant for the rest of the session) applies to the
   whole session, including the main conversation.
4. Background sub-agents keep MCP tools but lose most built-in tools (list above).
5. When sub-agents complete, their results return to the main conversation; running many
   verbose sub-agents can consume significant context.
6. Sub-agent transcripts are independent of the main conversation’s compaction.
7. Each sub-agent’s final report is scanned before Claude reads it (v2.1.210+): text
   imitating Claude Code output (such as `<system-reminder>` tags or `Human:` lines)
   gets a backslash so it reads as plain text, and a report that matches
   instruction-shaped patterns or mentions permission settings gets a leading
   `[harness: subagent output matched instruction-shaped pattern(s): ...]` line.
   Nothing is removed or reworded, the scan does not judge intent, and a tool call the
   report leads Claude to make still passes the session’s permission checks [V1].

#### Codex: Forks and the Shared Workspace

Re-verified on 2026-09-17 against the source at `b0659c53` [V16], [V20], [V38]. Codex’s
V2 developer instructions say that a full-history fork (`fork_turns` omitted or `all`)
inherits the parent’s model and reasoning effort and does not accept overrides, and that
`model` or `reasoning_effort` should be set only when the user, `AGENTS.md`, or a skill
asks, with `fork_turns` of `none` or a positive integer.
The runtime no longer enforces that sentence: `prepare_agent_spawn_config` applies
`model` and `reasoning_effort` on every spawn in both tool versions, and since PR #37252
(merged 2026-08-06, first in rust-v0.148.0) V2 also applies `agent_type` on a
full-history fork; only V1 rejects `agent_type` when `fork_context` is true.
Issue openai/codex#20077 stays open over the mismatch between the instructions and the
handler. The practical rule is unchanged: a spawn that needs a different tier sets
`fork_turns` to `none` or a number, because that is what the platform tells its model to
do and because a full-history fork carries the parent’s whole context into the child.
All agents share one filesystem and working directory, and edits are immediately
visible, so the prompts tell spawned agents they are not alone and must not revert
others’ work, and say whether they may spawn sub-agents themselves.
Both tool versions share the working copy: the child’s config copies the parent turn’s
`cwd`, approval policy, and permission profile, no code in the agent module creates a
worktree, and the V1 spawn description’s phrase “edit files directly in its forked
workspace” has no matching mechanism in the local CLI. V1 limits nesting to one level
(`agents.max_depth`, default 1) and V2 ignores that limit; V1 allows 6 sub-agent threads
and V2 4 concurrency slots including the root.

### Environments: CLI, IDE, Desktop, and Cloud (Claude Code)

#### Model Configuration Is Environment-Agnostic

There are no IDE-specific model settings.
Model configuration is based on scope (user, project, local) and environment variables,
not on which IDE or runtime you use, so the same settings and variables work in the
local CLI, the VS Code extension, the desktop app, and cloud sessions [V24]. The
sub-agent mechanism is the same everywhere too.
The one behavioral difference is between interactive and non-interactive sessions: fork
mode is on by default in an interactive session (every sub-agent runs in the background)
and off under `-p` and in the Agent SDK, and agent teams never spawn teammates under
`-p` [V1], [V3].

**Settings precedence (same everywhere)** [V24]: managed (enterprise, cannot be
overridden), then command line arguments, then local (`.claude/settings.local.json`),
then project (`.claude/settings.json`), then user (`~/.claude/settings.json`).

**Setting the model** [V23]: `claude --model opus`, `ANTHROPIC_MODEL=opus`, or the
`model` key in a settings file, in any environment; `/model opus` switches mid-session.
The sub-agent model is set the same way everywhere, with the settings `env` block shown
under Putting Every Sub-Agent on One Model or the real environment variables before
launch.

#### Cloud Sessions

*(Re-verified 2026-09-16 against the cloud pages [V25]. The product is now described as
“cloud sessions”, started from the browser at claude.ai/code, the mobile and desktop
apps, `claude --cloud`, or routines; the February 2026 name “Claude Code Cloud” is gone.
The page confirms that sub-agents “work the same way they do locally”, that
`.claude/agents/` definitions are picked up automatically, and that agent teams can be
enabled with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in the environment variables.)*

Cloud sessions run in isolated, Anthropic-managed VMs (or an organization’s self-hosted
environment) that clone the GitHub repository.
What reaches a cloud session: the committed `.claude/settings.json` and
`.claude/agents/`, the cloud environment dialog’s variables (in `.env` format),
server-managed settings (Enterprise and Teams), and `/model` during the session.
What does not: `~/.claude/settings.json`, the gitignored `.claude/settings.local.json`,
and shell `export` (each Bash call runs in a fresh shell, so a variable exported there
never reaches the agentic loop that spawns sub-agents).

Two supported ways to set the sub-agent model in the cloud: the environment dialog (for
example `CLAUDE_CODE_SUBAGENT_MODEL=opus`, `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`,
`ANTHROPIC_MODEL=opus`) [V25], and the committed project settings `env` block, which
takes effect for every cloud session and every team member [V24]. A third method from
February 2026, a `SessionStart` hook appending `export CLAUDE_CODE_SUBAGENT_MODEL=opus`
to `$CLAUDE_ENV_FILE`, was always doubtful (the file feeds later Bash commands, not
necessarily the sub-agent spawner), and as of 2026-09-16 `CLAUDE_ENV_FILE` no longer
appears on the environment variables page [V26], so it could not be re-verified either
way; treat the first two as the supported methods.

Other cloud notes, updated 2026-09-16 [V25], [V32]:

- `claude --cloud "task"` starts an independent cloud session from a terminal
  (`--remote` is a deprecated alias); `claude -p "message" --cloud <session-id>` queues
  a follow-up into a running one; the CLI cannot push an existing local session to the
  cloud.
- Cross-session messaging lets Claude list and message the user’s other sessions, local
  or cloud, so the February 2026 claim of “no instance-to-instance communication” no
  longer holds; there is still no orchestration API beyond this and the Agent SDK.
- Teleport (`claude --teleport <id>`, or `/teleport` and `/tp` in a session) pulls a
  cloud session and its branch into the local terminal as a separate copy; new local
  work does not flow back to the cloud session.
- When a cloud environment expires, background work that was still running (sub-agents
  and shell commands) is not restored on reopen.
- A cloud session cannot spawn a new cloud session directly *(not re-verified
  2026-09-16; the cloud page documents starting and messaging cloud sessions from a
  terminal, not from inside another cloud session)*. For autonomous restart in the
  cloud, the practical pattern is a `Stop` hook that forces a handoff, git-based state,
  and a human starting the next session (see Compaction and Self-Managed Handoff).

#### Verifying Which Model Sub-Agents Use

*(Updated 2026-09-16.)*

1. `/status` shows the current main model and account info [V34].
2. `/tasks` lists background items including finished sub-agents, with each sub-agent’s
   model and effort level (v2.1.242+); `/agents` no longer opens a panel (v2.1.198+), it
   prints the definition locations [V1].
3. `/model` shows the current model; `/effort` sets or shows the effort level.
4. Sub-agent transcripts live at
   `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl` [V1].
5. Ask Claude directly: “What model are your sub-agents configured to use?”
   A sub-agent cannot reliably report its own configuration, which is why tbd’s review
   header records the *requested* tier, model, and level.

**Does `/model` affect sub-agents?** Yes, for those that inherit, following the
resolution order above:

- Sub-agents with `model: inherit` (or no model field) follow `/model`, unless
  `CLAUDE_CODE_SUBAGENT_MODEL` is set, in which case that variable wins over the main
  model for them.
- Sub-agents with an explicit model in the call or the definition do not.
- Built-in Explore follows `/model` too (it inherits as of v2.1.198; the February 2026
  claim that it stays on Haiku is stale).
- `CLAUDE_CODE_SUBAGENT_MODEL` alone overrides nothing that names a model; only
  `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` overrides everything.
- Agent team teammates fix their model at spawn; `/model` changes only the lead.

### Vendor Guidance

#### Anthropic

- **When to delegate** [V1], [V3]: use sub-agents when the task produces verbose output
  the main context does not need, when tool restrictions or permissions should be
  enforced structurally, when the work is self-contained and can return a summary, or to
  isolate high-volume operations (test runs, log analysis).
  Stay in one conversation when phases share significant context (planning,
  implementation, testing), when the task needs frequent back-and-forth, when the change
  is quick and targeted, or when latency matters (a sub-agent starts fresh and needs
  time to gather context).
- **Patterns the docs recommend** [V1], [V3]: isolate high-volume operations; run
  parallel research and synthesize; chain sub-agents in sequence for multi-step work;
  specialize each with a focused prompt and a detailed `description` so Claude knows
  when to delegate; limit tool access (a reviewer needs no Write or Edit); resume with
  `SendMessage` rather than starting fresh; preload skills; enable memory for sub-agents
  that benefit from learning across sessions.
- **Delegation appetite differs by model:** Opus 5 delegates readily and should be told
  which scenarios warrant delegation, with deterministic caps for cost-sensitive work;
  Fable 5 and 5.1 guidance encourages parallel sub-agents [V7], [V8].
- **How many:** Claude Code allows depth 3 and 20 concurrent sub-agents by default [V1];
  agent teams work best at 3 to 5 teammates [V3]; the orchestration-mode example scouts
  first, then fans out to about ten subtasks for a module-sized review [V19].
- **Briefs:** a fresh sub-agent receives only its prompt plus project instructions, so
  the brief must carry paths, errors, and decisions [V5]; state an objective, an output
  format, tool guidance, and boundaries [V10].
- **Reports:** sub-agents should return condensed summaries of roughly 1,000 to 2,000
  tokens [V12].
- **Verification:** ask for evidence rather than assertions, and use a fresh-context
  reviewer that sees the diff and the criteria [V2]; fresh-context verifiers outperform
  self-critique, and auditing progress claims against tool results reduces fabricated
  status reports [V8]; verification is the cheapest delegation because it needs little
  context [V11].
- **Reviewer calibration:** Opus 5 follows “only report high-severity issues” literally
  and reports less; ask for every finding and filter separately [V7]. A reviewer told to
  find gaps will report some, so criteria should be concrete [V2].
- **Over-verification:** explicit “verify your work” or “use a subagent to verify”
  instructions cause Opus 5 to over-verify; it checks its own work without them [V7].
- **Tool restriction:** an omitted tool is absent from the sub-agent entirely, so tool
  allowlists are structural rather than advisory [V1].

#### OpenAI

- **Explicit authorization:** Codex spawns sub-agents only when the user, AGENTS.md, or
  a skill explicitly asks; requests for depth or thoroughness do not count; proactive
  delegation is part of the `ultra` level [V13], [V16].
- **What to delegate:** keep critical-path work local and delegate bounded side tasks
  that run alongside it; give code-editing sub-agents disjoint write sets and tell
  workers they are not alone in the codebase [V16].
- **Waiting and slots:** wait on sub-agents sparingly, and close finished agents, which
  otherwise hold concurrency slots [V16].
- **Read-heavy work:** sub-agents cost more tokens and suit read-heavy parallel work
  better than write-heavy coordinated work [V13].
- **When multi-agent helps:** split work into independent, bounded workstreams; avoid it
  when steps chain or agents contend for shared mutable state; the Responses API
  defaults to 3 concurrent sub-agents [V15].
- **Control:** agents-as-tools keep control with the orchestrator, while handoffs
  transfer the conversation [V15].
- **Effort:** choose effort by task (low for scoped work, medium or high for complex
  changes, extra-high for long agentic tasks); establish a baseline and raise effort
  only when evaluations show gains; `max` is not recommended as a global default [V14].
- **Astra:** may delegate less often than desired; the recommended prompt tells it to
  delegate whenever parallel work saves time or improves quality [V18].
- **Forking and overrides:** the instructions say a full-history fork inherits the
  parent’s model and effort and does not accept overrides, so set `fork_turns` to `none`
  or a number when choosing a tier; the runtime applies the overrides either way, and
  openai/codex#20077 tracks the mismatch [V16], [V38].
- **Sub-agent models:** start with `gpt-5.6` for demanding agents and use
  `gpt-5.6-terra` or `gpt-5.6-luna` for lighter, read-heavy sub-agent work; a custom
  agent file’s `model` and `model_reasoning_effort` take precedence over the spawn’s
  values [V13].
- **Offloading:** keep the main agent on the core problem and use sub-agents for bounded
  work such as exploration, tests, or triage [V14].

#### Cost

- Multi-agent work uses roughly 3 to 10 times the tokens of a single agent [V11], and
  about 15 times chat in Anthropic’s research system, where a single agent already used
  about 4 times chat [V10].
- That system (June 2025) used an orchestrator-worker pattern with Opus 4 as lead and
  Sonnet 4 sub-agents to balance capability and cost, and reported a 90.2% improvement
  over single-agent Opus 4 on internal evaluations [V10]. Use smaller models for stages
  that do not need the strongest [V4], and `low` effort for simple mechanical sub-agents
  [V6].
- Running every sub-agent on the top-tier model multiplies token cost accordingly; each
  sub-agent has its own context window, many verbose results consume the parent’s
  context, and agent teams cost more still because each teammate is a separate instance
  [V3], [V4].
- Claude Code levers *(updated 2026-09-16)*: the `opusplan` alias (Opus for planning,
  Sonnet for execution) [V23]; `CLAUDE_CODE_SUBAGENT_MODEL=haiku` to push Explore and
  other unnamed spawns to a cheaper model (a default; add the force flag to make it
  apply everywhere); `maxTurns` in the definition (partial output is marked as such,
  v2.1.246+) or `--max-turns` for `-p` runs; `effort: low` or `medium` in definitions
  for simple stages; and asking whether agent teams are justified over plain sub-agents.

### System Prompts and Prompt Caching for Sub-Agents

*(Added 2026-09-17.)* This section answers two questions the tier agent definitions
raise: what system prompt a sub-agent actually runs under, and what a fresh sub-agent
costs once prompt caching is taken into account.
The Claude Code facts come from the sub-agents page [V1] and the Claude Code prompt
caching page [V39], the API facts from the prompt caching reference [V40], and the Codex
facts from the source [V16], [V41]. The OpenAI prompt caching guide [V42] and pricing
page [V46] were re-read on 2026-09-18.

#### What System Prompt a Sub-Agent Runs Under

**Claude Code.** A custom sub-agent does not get the Claude Code system prompt.
The docs say: “Subagents receive only this system prompt plus basic environment details
like the working directory, not the Claude Code system prompt” [V1]. Its request is
assembled from:

- the definition body, plus the environment details Claude Code appends (working
  directory, platform, date);
- the tool definitions it inherits (every tool available to sub-agents, narrowed by a
  `tools` allowlist and, for background sub-agents, the built-in tool filter);
- every `CLAUDE.md` the main conversation loads, unless `omitClaudeMd: true`;
- the git status snapshot from parent session start;
- preloaded skill content, only for skills named in a `skills` field;
- the task message the coordinator wrote.

Everything the Claude Code system prompt supplies is absent; the harness still adds a
short framing, environment details, a few reporting notes, and the tool descriptions,
which include a commit-only-when-asked line, but none of that is documented, so the body
and brief must carry the rules.
The sub-agent can still discover and invoke skills through the Skill tool, so the tbd
skill is reachable, but nothing loads it.
Two consequences for the tier definitions:

1. The body is not redundant with anything.
   It is the sub-agent’s entire behavioral system prompt, so a rule that the main
   session gets for free (do not commit, do not push, do not start sub-agents) has to be
   stated there or in the brief to exist at all.
2. The body is where a project-neutral bootstrap belongs, and only that.
   The line that names `tbd shortcut <name>` is what turns an otherwise generic model
   with tools into a tbd agent, because `CLAUDE.md` says to read the project docs but
   does not say how to load a shortcut.
   A claim in the body about its own model is unreliable: a per-call `model` on the
   Agent tool overrides the definition, and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` overrides
   both [V1], so a body that says “opus at medium reasoning” can be wrong about the
   model while right about the effort.

`CLAUDE.md` is loaded into every sub-agent, so whatever it instructs is paid on every
spawn. In this repository, `CLAUDE.md` tells the agent to read `docs/development.md`,
`docs/docs-overview.md`, and `tbd guidelines general-eng-agent-principles` before any
engineering work, which a reviewer sub-agent will do on each spawn (roughly 10k tokens
of reads) before it loads its shortcut.

**Codex.** A fresh (non-fork) child starts from the parent’s effective config and
receives the session’s current base instructions, the same Codex system prompt the
parent runs under: `build_agent_spawn_config` sets
`config.base_instructions = Some(base_instructions.text.clone())` for a fresh spawn
[V41]. The child shares the parent’s `cwd`, so the project `AGENTS.md` applies to it the
way it applies to any Codex session in that directory.
A custom agent role’s `developer_instructions` **replaces** the developer instructions
rather than appending: `build_next_config` assigns
`next_config.developer_instructions = Some(instructions.clone())` when the role sets
them [V41]. So a `.codex/agents/tbd-*.toml` body sits on top of the full Codex prompt
and `AGENTS.md`, unlike the Claude Code body, which sits on top of nothing.
Codex’s own built-in `awaiter` role (currently commented out of the role list, but still
shipped) is the closest analogue to a fast-tier definition: it sets
`model_reasoning_effort = "low"`, a long background-terminal timeout, and a body that
tells the agent to await one task, poll with growing timeouts, and never report
completion it has not seen [V41].

**What this means for portability.** On both platforms the brief is the only
cross-platform artifact: it carries the task, the shortcut name, the boundaries, and the
report format, and the same brief works whether or not a definition exists.
A definition binds a model and a reasoning level (both platforms), replaces the
developer instructions (Codex), or supplies the whole behavioral prompt (Claude Code).
Guidance that must hold on every platform therefore belongs in the brief and in the
shortcut the brief names, never only in a definition.

#### What Each Definition Buys, Platform by Platform

| Platform | Model per spawn | Reasoning level per spawn | What a `tbd-*` definition adds |
| --- | --- | --- | --- |
| Claude Code | Yes, `model` on the Agent tool | **No** | `effort` (the only per-sub-agent reasoning control), a stable name in the coordinator’s agent list with a description that says when to pick it, and optionally a per-sub-agent cache TTL (`experimental.cacheTtl`) [V1], [V39] |
| Codex | Yes, `model` on `spawn_agent` | Yes, `reasoning_effort` on `spawn_agent` | A name; its `model` and `model_reasoning_effort` take precedence over the spawn values, and its `developer_instructions` replace the parent’s [V13], [V41] |
| Other platforms | Platform-dependent | Platform-dependent | Nothing generated; apply the tier by the platform’s own controls |

On Claude Code, a definition changes the model and level only when its level differs
from the session’s; it still supplies the body, so prefer a `tbd-*` definition whenever
the brief does not restate those rules.
A session already running at `xhigh` gets the same model and level from `model: fable`
or `model: opus` on the Agent call as from `tbd-strong` or `tbd-moderate`; only
`tbd-strong-max` (`max`) and `tbd-fast` (`medium`) change the level.
Below `xhigh`, every definition whose level differs from the session’s changes it; a
session already at `medium` is the one case `tbd-fast` leaves alone.

#### Prompt Caching: How the Cache Is Organized

The API caches by exact prefix match, in the order tools, then system, then messages,
and any change invalidates everything after it [V40]. Claude Code orders each request so
the stable content comes first: the system prompt and tool definitions, then the project
context (`CLAUDE.md`, auto memory), then the conversation [V39]. Skills, plan mode
instructions, and file reads append as messages, so they never disturb the cached prefix
[V39].

Pricing (Claude API) [V40]: a cache write costs 1.25 times the base input price with the
5-minute TTL and 2 times with the 1-hour TTL; a cache read costs 0.1 times base (0.025
times on Fable 5.1 and Mythos 5.1). The minimum cacheable prefix is 512 tokens on Fable
5, Fable 5.1, and Opus 5 (1,024 on Sonnet 5 and Opus 4.8; 4,096 on Opus 4.6 and Haiku
4.5). The TTL is measured from the start of the request that wrote or read the entry,
and reading within the TTL refreshes it at no extra cost.
Caches are per model: identical prompts to Fable and to Opus are two entries [V39].
Caches are effectively per machine and directory in Claude Code, because the system
prompt names the working directory and the auto memory paths; two sessions in the same
directory build matching prefixes and read each other’s cache, and worktrees do not
[V39].

Two settings split the cache without changing the prompt text [V39], [V40]:

- **Model.** Each model has its own cache; a switch recomputes the entire request.
- **Effort.** On most models each effort level has its own cache, so a change recomputes
  the entire request. On Fable 5.1 with an API key or a Claude subscription the cache
  survives an effort change (v2.1.260+); this does not hold on Bedrock, Google Cloud, or
  a Claude apps gateway, or with `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`. At the API
  level, a change to `output_config.effort` always invalidates the messages cache, and
  whether it invalidates the tools and system caches is model-specific.

#### Prompt Caching: What Happens When a Sub-Agent Starts

The Claude Code prompt caching page has a section on this [V39], and its rules are:

- **A fresh sub-agent starts its own conversation with its own prefix.** Its first
  request does not read the parent’s cache, because the two prefixes differ (different
  system prompt, possibly different tools and model), and it warms a cache of its own
  across its turns.
- **The parent’s cache is unaffected.** The Agent call and the sub-agent’s report append
  to the parent’s conversation, so the parent’s prefix stays intact.
  Spawning a sub-agent is listed among the actions that keep the cache.
- **A fork reads the parent’s cache.** It inherits the parent’s system prompt, tools,
  and history exactly, so its first request is a cache read of the whole parent context.
- **A resumed sub-agent reads the cache its first run warmed** (SendMessage), and stays
  on the tool set and per-invocation model of its first run.
- **Sub-agents get the 5-minute TTL by default, even on a subscription.** Claude Code
  splits requests into two buckets: the main conversation, which gets the 1-hour TTL on
  a Claude subscription within plan usage, and everything else (sub-agents, workflows,
  in-process teammates, forks, compaction), which gets 5 minutes unless
  `subagentPromptCacheTtl` or `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` says `1h`, or the
  definition’s `experimental.cacheTtl` does (v2.1.248+; a `1h` there is ignored while
  the subscription is on usage credits).
  Those TTL settings require Claude Code v2.1.242 or later; older builds silently ignore
  them. On an API key or a cloud provider both buckets get 5 minutes.
- **Same-prefix sub-agents share a cache.** Two spawns of the same definition on the
  same model in the same directory build the same prefix (tools, body, `CLAUDE.md`, git
  snapshot), so the second reads what the first wrote, if it starts within the TTL. A
  cache entry becomes available only after the first response begins [V40], so
  sub-agents spawned in the same instant all miss; the Workflow tool holds all but the
  first of a same-prefix fan-out for up to 5 seconds for this reason; the page documents
  the hold for workflow fan-outs only.
- **Different tiers do not share.** `tbd-strong` (Fable) and `tbd-moderate` (Opus) are
  on different models; `tbd-moderate` (`xhigh`) and `tbd-fast` (`medium`) are on the
  same model at different effort levels, which on Opus are different caches.
  Nothing is lost by this, because they were never going to share a prefix with the
  coordinator either.

Cache hits and misses are visible per turn as `cache_read_input_tokens` and
`cache_creation_input_tokens`, per session in `/usage` (the `Prompt cache (main)` line
covers the main conversation only, v2.1.251+), and in
`claude -p ... --output-format json` under `usage.cache_creation`
(`ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens` show which TTL was used)
[V39].

#### What a Fresh Sub-Agent Actually Costs

The fresh-context “tax” is smaller than it sounds, and the fork alternative is not
cheaper. Working through a tbd reviewer on Claude Code, with sizes from this repository
as of 2026-09-17 (about 4 bytes per token):

| Item | Approximate tokens | When paid |
| --- | --- | --- |
| Definition body and environment details | under 300 | Once per spawn, as a cache write |
| Built-in tool definitions | on the order of 10k to 15k (MCP tools are deferred behind tool search on supported models, so they add little) | Once per spawn, as a cache write; shared with earlier same-prefix spawns within the TTL |
| `CLAUDE.md` (this repository) | about 180 | Once per spawn |
| Docs `CLAUDE.md` tells the agent to read (`development.md`, `docs-overview.md`, `general-eng-agent-principles`) | about 10k | Once per spawn, as ordinary input that is then cached |
| `tbd shortcut review-github-pr` + `pr-review-workflows` + `code-review-rules` | about 3k + 5k + 3k | Once per spawn, then cached |
| The diff and the files it reads | task-dependent | Once, then cached |
| Every later turn | the whole prefix at 0.1x (0.025x on Fable 5.1) plus the new tool result | Per turn |

At Opus 5 list prices ($5 per million input tokens), the one-time write of a 20k-token
prefix is about $0.13 with the 5-minute TTL, and each later turn re-reads it for about
$0.01. The reviewer’s cost is dominated by its own work (the diff, the files, the tests
it runs, and its output), not by starting fresh.

A fork of a 150k-token coordinator context, by comparison, pays a cache read of 150k
tokens on its first request (about $0.075 at Opus, less on Fable 5.1) and again on every
turn. The worked example below (a 30-turn review on Opus 5) puts that at about $2.40 in
cache reads as a fork against about $0.60 as a fresh sub-agent with a 20k-to-60k prefix,
before the work itself.
The fork also cannot change model or effort and is anchored on the coordinator’s
reading. For review, fresh is both cheaper per turn and better.

Where the multiplier in Anthropic’s “3 to 15 times” figure [V10], [V11] actually comes
from, given caching:

- **More turns, not more expensive turns.** Each sub-agent gathers its own context
  (reads the diff, the files, the docs) that the coordinator may already hold, and each
  of those reads is a turn.
- **N prefixes.** Every sub-agent carries its own tool definitions and project context,
  so N sub-agents pay the prefix N times rather than once.
- **Reports land in the coordinator.** A report is appended to the coordinator’s
  conversation and re-read at the cached rate on every later coordinator turn for the
  rest of the session, which is why the shortcuts ask for reports of a page or two and
  for evidence rather than transcripts.
- **Expiry between phases.** A reviewer that finishes, then an addressing agent that
  starts 20 minutes later on a different definition, shares nothing; and a coordinator
  that waits more than 5 minutes between turns of its own on an API key loses its own
  prefix (the main conversation on a subscription has an hour).

Three practical rules follow:

1. **Prefer the shortest prefix that does the job.** The definition body should stay
   small, `CLAUDE.md` content is paid on every spawn, and a `skills` preload is paid on
   every spawn whether the sub-agent needs it or not.
   Loading the shortcut from the brief (as tbd does) costs the same tokens as preloading
   it but only for the sub-agents that need it, and keeps the definition portable.
2. **Spawn same-prefix sub-agents a few seconds apart, or accept the miss.** The miss is
   one prefix write, on the order of $0.10, so this matters only for large fan-outs.
3. **Set the sub-agent TTL to an hour when sub-agents wait.** A fast-tier sub-agent that
   polls CI every few minutes is exactly the case the API docs name for the 1-hour TTL
   ("an agentic side-agent will take longer than 5 minutes") [V40]; each poll under the
   5-minute TTL keeps the entry warm anyway, but a poll interval above 5 minutes does
   not, and then every poll rewrites the prefix.
   The cost is a 2x write instead of 1.25x, on a prefix that is small.

#### Caching From First Principles: What Is Paid, When, and Why

*(Added 2026-09-17.)* The rules above follow from one mechanism, and working from it
explains every cost figure in this brief.
Prices are Claude API list prices on 2026-09-17 [V43]. OpenAI multipliers and list
prices were re-read on 2026-09-18 [V42], [V46].

**Why a cache exists.** A model has no memory between requests.
Every turn of an agent loop is a new request carrying the entire conversation so far:
system prompt, tool definitions, every message, every tool result, and the new input.
Without a cache the provider re-runs the prefill (the forward pass over the input) for
all of it on every turn, and the bill is the full input each time.
The prefill for an identical prefix produces identical internal state, so a provider can
store that state and skip the recomputation.
Prompt caching is exactly that: a store of computed state keyed by an exact byte prefix
of the request, on a specific model, with a time to live.
It is a cache of computation, not of text, which is why it must be per model (the state
is model-specific) and why any change before a given point changes everything after it
(the state at token *n* depends on all tokens before *n*).

**How a Claude turn is billed.** A request’s input tokens fall into three buckets, and
`usage` reports each [V40]:

| Bucket | Field | Price (multiplier of base input) |
| --- | --- | --- |
| Read from cache | `cache_read_input_tokens` | 0.1x (0.025x on Fable 5.1 and Mythos 5.1) |
| Written to cache now | `cache_creation_input_tokens` | 1.25x for a 5-minute entry, 2x for a 1-hour entry |
| Neither (after the last breakpoint) | `input_tokens` | 1x |

Output tokens, including thinking, are billed at the output price and are never cached.
The provider decides the buckets by looking for a cache entry at the request’s cache
breakpoint (Claude Code places one at the end of the conversation on every request),
walking back up to 20 blocks if the exact prefix is not there, and treating everything
before the entry it finds as a read and everything from there to the breakpoint as a
write. Runs of tool calls and tool results count as one block each for that walk, and
Claude Code adds fewer than 20 blocks per turn, so a steady conversation always finds
the previous turn’s entry [V40].

The consequence for an agent loop: on a normal turn, the whole prior conversation is a
read and only the last exchange (the model’s previous output plus the new tool result)
is a write. A turn costs roughly `0.1 × prefix + 1.25 × new` (Opus) or
`0.025 × prefix + 1.25 × new` (Fable 5.1), in units of the base input price, plus
output. Growing context therefore costs about a tenth of what the context size suggests,
and a long session’s per-turn cost grows linearly but slowly.

**Why writes cost more than reads and why the 1-hour entry costs twice.** A write is the
full prefill plus storage; a read is storage retrieval.
The write premium (25% for five minutes, 100% for an hour) prices the storage time.
A 5-minute entry pays for itself after one read (1.25 + 0.1 = 1.35 against 2 uncached)
and a 1-hour entry after two (2 + 0.2 = 2.2 against 3) [V43], so either entry beats no
caching after a few turns; the 1-hour entry beats the 5-minute one only when a gap
between requests exceeds five minutes, and an agent that takes one turn and stops pays
double for nothing.

**Per-model prices as of 2026-09-17** [V43], per million tokens:

| Model | Base input | 5m write | 1h write | Read | Output | Min cacheable prefix |
| --- | --- | --- | --- | --- | --- | --- |
| Fable 5.1 | $10 | $12.50 | $20 | $0.25 | $50 | 512 |
| Fable 5 | $10 | $12.50 | $20 | $1 | $50 | 512 |
| Opus 5 | $5 | $6.25 | $10 | $0.50 | $25 | 512 |
| Opus 4.8 | $5 | $6.25 | $10 | $0.50 | $25 | 1,024 |
| Sonnet 5 | $2 | $2.50 | $4 | $0.20 | $10 | 1,024 |
| Haiku 4.5 | $1 | $1.25 | $2 | $0.10 | $5 | 4,096 |

Three things in this table change the arithmetic between tiers:

- **Fable 5.1 reads at 2.5%, not 10%.** Its base input is twice Opus 5’s, but a cached
  read is half the price of an Opus 5 read.
  A long strong-tier review on Fable 5.1 therefore pays less per turn for its context
  than the same review on Opus 5, and the Fable premium is concentrated in the first
  write and in output.
  Fable 5 (not 5.1) reads at 10%, so this applies to 5.1 only.
- **Models from Opus 4.7 on tokenize about 30% more tokens for the same text** [V43], so
  a token count measured on Sonnet 4.6 or earlier understates what Opus 5 and Fable
  bill. The estimates in this brief were made with the newer tokenizer’s rate in mind
  (roughly 4 characters per token is a fair average across both).
- **Prefixes under the minimum are never cached** and are silently billed at full price
  [V40]. A tier definition body alone is far under 512 tokens; it is cacheable only
  because it sits behind the tool definitions and `CLAUDE.md`.

**How Claude Code arranges the request so most of it is stable.** Claude Code orders
each request as system prompt and tool definitions, then project context (`CLAUDE.md`,
auto memory, rules), then the conversation, with one breakpoint at the end [V39].
Content that must change every turn is placed at the end, and content that changes
mid-session is appended as a message rather than edited in place: skills, plan-mode
instructions, output-style changes, file-change notices, and (on the Claude 5 family)
mid-conversation system additions all go into `messages`, sometimes as a
`{"role": "system"}` message, so the cached prefix is untouched [V39], [V40]. This is
the design rule behind “Actions that keep the cache” on the Claude Code page, and it is
the rule an orchestrator should copy: **append, never edit**.

**Variable expansion and small changes.** Because the key is the exact byte prefix, a
single changed character anywhere in the system prompt or tool definitions is a full
miss: every token after the change is rewritten at 1.25x or 2x. The cases that matter
for sub-agents:

- *Per-request values in the prefix.* A timestamp, a run ID, a random nonce, or a
  “today’s date” rendered into the system prompt at every spawn makes every spawn a full
  write. The API docs give this exact example: a timestamp before the breakpoint means
  “no cache hit” on every request [V40]. Claude Code renders the working directory,
  platform, OS version, and the git-status snapshot into the prefix, which is why its
  cache is per machine and directory [V39]; those values are stable within a session and
  across sessions on one machine, so they cost nothing after the first write, but they
  do mean that two machines never share a cache.
- *The tier definition body.* It is rendered into the sub-agent’s system prompt.
  A body that varies per spawn (a date or the coordinator’s session ID) would put the
  variable part ahead of `CLAUDE.md` and the conversation and make every spawn of that
  definition a full write.
  The generated tbd bodies are constant per definition, so every spawn of `tbd-strong`
  on the same machine within the TTL reads the previous spawn’s prefix.
  The old model name was also constant within each definition, so removing it does not
  improve within-definition cache reuse.
  It remains worth removing because a runtime override could make that static
  description false.
- *Tool definitions.* Any change to the set or text of tool definitions invalidates
  everything, because tools come first.
  In Claude Code this happens when an MCP server connects or disconnects with its tools
  loaded into the prefix (deferred tools, the default, only append), when a tool is
  denied outright without tool search, and on a Claude Code upgrade [V39]. A sub-agent
  with a `tools` allowlist has a different tool set from the parent and from a sub-agent
  without one, so it has a different prefix, which costs nothing by itself but means the
  two never share.
- *`CLAUDE.md` edits.* Read once at session start and held in memory, so an edit neither
  invalidates the cache nor takes effect until `/clear`, `/compact`, or a restart; a
  sub-agent spawned later in the session gets the version loaded at session start [V39].
- *Model and effort.* Not text changes, but part of the cache key.
  A different model is always a different cache.
  Effort is rendered into the prompt on most models, so a change to
  `output_config.effort` invalidates the messages cache and, on models that render it
  ahead of the system prompt, the tools and system caches too [V40]. The API offers an
  escape hatch on Fable 5.1, Mythos 5.1, and Opus 5: a `{"role": "system"}` message with
  empty content and an `output_config.effort`, appended to `messages` (beta
  `mid-conversation-output-config-2026-07-01`), changes the effort from that point on
  without touching the cached prefix [V45]. Claude Code uses this so that Fable 5.1 on
  an API key or subscription keeps the cache across an effort change (v2.1.260+), and
  documents the exception for Fable 5.1 only [V39]. Thinking configuration
  (`budget_tokens`, mode) behaves the same way as a top-level effort change.
  For tiers: `tbd-moderate` at `xhigh` and `tbd-fast` at `medium` on Opus have separate
  full prefixes. On Fable 5.1 through the API or a subscription, effort alone does not
  invalidate an otherwise identical prefix.
  `tbd-strong` and `tbd-strong-max` still have different definition bodies, so they do
  not share a full prefix [V39].
- *Thinking blocks across turns.* On Opus 4.5 and later and Sonnet 4.6 and later,
  earlier thinking blocks stay in the context and the cache holds across a
  non-tool-result user turn; on earlier models and Haiku 4.5, a non-tool-result user
  message strips prior thinking blocks and invalidates the messages cache [V40]. Inside
  a tool loop this never triggers, because every turn is a tool result; it matters when
  the coordinator sends a follow-up message to a resumed sub-agent on an older model.
  Fable 5.1 adds a stricter rule in the other direction: editing or deleting an earlier
  turn (an injected-then-removed reminder, a rewritten tool result) invalidates every
  later thinking block, and accounts created from 2026-08-31 get a 400 on such history
  [V45]. A harness for it must be append-only, which is the same rule caching already
  rewards.

**Single session versus sub-agents: the same mechanism, different prefixes.** A single
session has one prefix that grows.
Every turn pays a read of everything so far plus a write of the newest exchange, and the
read grows with the session.
A fresh sub-agent starts a second prefix that is short, grows during its run, and is
then abandoned. It does not share the parent’s prefix because its system prompt is its
definition body rather than the Claude Code system prompt [V1], [V39]. A fork inherits
the parent’s prefix, but its new tool calls stay isolated and only its final result
returns to the coordinator [V1]. The trade is:

|  | Inline session | Fork | Fresh sub-agent |
| --- | --- | --- | --- |
| First request | Reads the existing coordinator prefix | Reads the inherited parent prefix | Writes its own prefix: tools, body, `CLAUDE.md`, git snapshot, brief |
| Each later turn | Reads the whole coordinator session so far | Reads the inherited parent history plus its own growing conversation | Reads only its own, shorter conversation |
| At the end | The tool transcript stays in the coordinator’s context and is re-read on later turns | Only the final report enters the coordinator’s context | Only the final report enters the coordinator’s context |
| Model and level | The session’s | The parent session’s | Any |
| Prefix lifetime | 1 hour on a subscription within plan usage, else 5 minutes | Can read the inherited parent entry; new writes last 5 minutes unless raised | 5 minutes unless raised |

Worked through for a 30-turn review on Opus 5, base $5 per million:

- *As a fork of a 150k-token coordinator:* first request reads 150k (about $0.075), and
  every later turn reads 150k plus what the review has added; about 30 × $0.08 =
  **$2.40** in context reads, plus the review’s own reads and output.
  The fork keeps its 30 turns of new tool output isolated and returns only its final
  report, but it still carries the inherited 150k-token input on every turn.
- *As a fresh sub-agent with a 20k prefix that grows to 60k:* one write of 20k (about
  $0.13), then reads averaging 40k per turn, about 30 × $0.02 = **$0.60**, plus the same
  review work, and afterwards the coordinator carries a two-page report.
- *On Fable 5.1* the fork’s reads fall by half (about $1.20 for the same 30 turns,
  because reads are $0.25 per million) and the fresh sub-agent’s to about $0.30, while
  the one-time write rises to about $0.25; the ranking does not change.

The review’s own work (reading a diff of 20k tokens, running tests that return 5k tokens
each, writing 5k tokens of findings at $25 per million output on Opus) costs on the
order of $0.50 to $1.50 either way and dominates.
So for anything longer than a few turns, the fresh sub-agent is cheaper as well as
independent, and the “3 to 15 times” multiplier for multi-agent work [V10], [V11] comes
from doing more work (N agents each reading the code, plus the coordinator), not from
paying a fresh-context penalty.

Where a fork *is* cheaper: a one- or two-turn task that needs the conversation, such as
“summarize what we decided” or “check the thing we discussed against this file”, where a
fresh sub-agent would have to be told everything the fork already has.
That is the case the `delegate-to-subagents` shortcut reserves forks for.

**The TTL, end to end.** An entry’s TTL is measured from the start of the request that
wrote or last read it, not from the end of the response, so a four-minute response
leaves one minute of a 5-minute TTL for the next request to start [V40]. Reading within
the TTL refreshes it for free.
Claude Code decides the TTL per request in two buckets [V39]:

| Request | Subscription, within plan usage | API key, cloud provider, or subscription on usage credits |
| --- | --- | --- |
| Main conversation | 1 hour | 5 minutes |
| Sub-agents, forks, workflows, teammates, compaction | 5 minutes | 5 minutes |

The overrides, first match wins: `FORCE_PROMPT_CACHING_5M=1`;
`CLAUDE_CODE_PROMPT_CACHE_TTL` or `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL`; the
`promptCacheTtl` or `subagentPromptCacheTtl` setting; the definition’s
`experimental.cacheTtl` (ignored for `1h` on usage credits);
`ENABLE_PROMPT_CACHING_1H=1`; the bucket default [V39].

What expiry costs, and when it happens in a tbd workflow:

- *A sub-agent that works continuously* never expires: every turn refreshes the entry.
  The 5-minute default is fine for a reviewer or an addressing agent.
- *A sub-agent that waits* expires whenever a single wait exceeds the TTL. A CI poll
  every 10 minutes under a 5-minute TTL rewrites the whole prefix on every poll (at
  1.25x), which for a 30k prefix on Opus is about $0.19 per poll, or about $1.10 per
  hour of waiting. Polling inside the 5-minute TTL avoids those repeated writes, but the
  extra polls are still paid reads.
  With a constant 30k-token Opus prefix and no output, polls at minutes 0, 4, …, 60 cost
  one $0.1875 write plus 15 × $0.015 reads, or **$0.4125**. Polls at minutes 0, 10, …,
  60 under a 1-hour TTL cost one $0.30 write plus 6 × $0.015 reads, or **$0.3900**
  [V40]. The 4-minute schedule detects completion sooner, while the 10-minute schedule
  is cheaper in this example.
  Choose the TTL and interval from the prefix size, added poll input and output, and
  required detection latency; a longer TTL can cost less when less frequent polls are
  acceptable. At the API level there is a third option that Claude Code does not expose:
  re-send the previous request with `max_tokens: 0` just before the entry would expire,
  which refreshes the timer for the price of one cache read and no output; on Fable 5.1,
  where a read is 2.5% of base, this beats the 1-hour TTL unless pauses approach an hour
  [V40]. In Claude Code the levers are the TTL settings and the poll interval.
- *The coordinator between phases* expires on an API key when it waits more than five
  minutes for a sub-agent, which it usually does, and then pays a full write of its own
  context on its next turn.
  On a subscription within plan usage the coordinator has an hour.
  On an API key, `promptCacheTtl: 1h` is worth setting for any session that delegates.
- *Between the reviewer and the addressing agent* nothing is shared regardless of TTL,
  because they are different definitions on different models.
  The addressing agent reads the review from GitHub, not from the reviewer’s context,
  which is by design.
- *A resumed sub-agent* (SendMessage) reads its own earlier prefix if the TTL has not
  passed, and rewrites it if it has [V39]. Continuing a sub-agent within five minutes is
  nearly free; continuing it an hour later costs the same as a fresh start plus the
  transcript it carries.

**Reports as a recurring cost.** A sub-agent’s report is appended to the coordinator’s
conversation and read at the cached rate on every later coordinator turn.
At Opus 5 rates, a 2,000-token report costs the coordinator $0.001 per turn thereafter;
a 20,000-token transcript costs $0.01 per turn, and after 100 coordinator turns that is
$1 for having asked for the transcript instead of the summary.
It also displaces context.
This is the arithmetic behind the “page or two” rule in `delegate-to-subagents`.

**Bedrock, Google Cloud, Foundry, and gateways.** The mechanism is the same but the
cache lives in the provider’s infrastructure, prompt caching support and 1-hour
availability vary by model on Bedrock (the per-model minimum prefix is the same on every
platform [V40]), the effort-change exception for Fable 5.1 does not apply, and a gateway
that strips `cache_control` markers silently turns every turn into full-price input
[V39]. Check `cache_read_input_tokens` in the response before assuming caching works
through any intermediary.

**Codex and the OpenAI API.** *(OpenAI pages re-read 2026-09-18 [V42], [V46]; Codex
facts remain from source [V44].)*

OpenAI now has two caching regimes, and the older “automatic prefix, no write premium”
description applies only to models before GPT-5.6.

- **GPT-5.6 and later** (including `gpt-5.6-sol` and `gpt-6-astra`) [V42], [V46]: cache
  writes cost 1.25× uncached input and cache reads 0.1× (list prices on 2026-09-18,
  standard short context: `gpt-5.6-sol` $4 / $0.40 cached / $5.00 write per 1M;
  `gpt-6-astra` $10 / $1.00 / $12.50). The minimum cacheable prefix is 1,024 tokens.
  Default lifetime is `prompt_cache_options.ttl: "30m"` (the only supported TTL): an
  entry stays eligible for 30 minutes after the latest write or reuse, and OpenAI may
  keep it longer. Both implicit and explicit caching exist.
  Implicit mode writes one breakpoint, at the end of the latest eligible message (user,
  last tool response in a group, or the initial consecutive developer-message block).
  Lookups are wider than writes: an incoming request also checks up to 20 earlier
  eligible message endings and the end of the initial developer block, which is what
  lets a growing conversation reuse an earlier turn’s entry.
  A lookup boundary only helps if some request wrote an entry ending there, so a request
  whose user suffix changes does **not** reuse a shared developer prefix unless that
  prefix has its own explicit breakpoint (`prompt_cache_options.mode: "explicit"` plus
  `prompt_cache_breakpoint` on the stable content).
  [V42] states this case and this remedy directly, under “A shared prefix is not always
  a cached prefix”: a static developer message followed by changing user content writes
  through the changing content, and “caching the first complete request implicitly-only
  does not make the shorter shared prefix reusable”.
  Cache writes are not an additive fee: each input token is billed as uncached, cached,
  or cache-write. Usage reports `cached_tokens` and `cache_write_tokens` under
  `usage.input_tokens_details` on the Responses API (`prompt_tokens_details` on Chat
  Completions). `prompt_cache_key` is optional on these models and is for separate cache
  *accounting* (customers, users, workspaces), not for routing a hit.
  Changing top-level `reasoning.effort` can rewrite hidden system instructions and miss
  the prefix; on supported GPT-6 models, append a `configuration_update` input item and
  leave the original top-level effort unchanged.
- **Earlier models** [V42]: caching is automatic, with no explicit breakpoints and no
  cache-write fee. Prefix matching is best-effort from the start of the request once the
  prompt meets a minimum the page declines to state as a number: it varies by model and
  by request settings (tools, images, output schemas, reasoning effort, verbosity), so
  measure it per model.
  Implicit breakpoints fall at regular intervals rather than at message ends: 2,048
  tokens on GPT-5.5 and GPT-5.5 Pro, model-dependent on the rest.
  Reported `cached_tokens` rounds down to a multiple of 128 after subtracting hidden
  system tokens. Retention is `prompt_cache_retention`: `in_memory` (typically 5 to 10
  minutes of inactivity, up to about an hour) or `24h` (typically around 30 minutes, up
  to 24 hours). On these models `prompt_cache_key` *does* matter for hit rate: a stable
  key helps route related requests to the same cache; the docs suggest about 15 requests
  per minute per key for busy groups.
- **Codex** [V44]: still sets `prompt_cache_key` to the session ID, and for an
  internally spawned thread to `<source>:<parent_thread_id>`. It sends full history
  except over a WebSocket (`previous_response_id`, `store: false`,
  `reasoning.encrypted_content`). `codex-rs/core/src/client.rs` at `main` carries
  `prompt_cache_key` and its override and nothing else from that family: no
  `prompt_cache_options`, `prompt_cache_breakpoint`, or `prompt_cache_retention`
  (re-read 2026-09-18), so on GPT-5.6+ Codex runs in the default implicit mode and never
  places an explicit breakpoint.
  A `tbd-*` Codex role replaces developer instructions, so the shared prefix with the
  parent stops where those instructions differ.
  Codex’s model still tells sub-agents to prefer minute-scale waits [V20], which fits
  the earlier-model in-memory window and the GPT-5.6 30-minute TTL, but on GPT-5.6+
  implicit mode, because Codex sends no explicit breakpoint, a fresh child with a
  different task message misses the parent’s prefix.

The practical difference is no longer “Claude charges for writes, OpenAI does not.”
On GPT-5.6+ both providers bill a 1.25× write and a 0.1× read.
Claude still offers an explicit 1-hour TTL (2× write) beside the 5-minute default;
OpenAI’s documented TTL on GPT-5.6+ is 30 minutes.
On earlier OpenAI models there is still no write premium, a shorter in-memory lifetime,
and key-based routing.
On both providers, keep the prefix constant per definition, append rather than edit,
keep reports short, and do not let a waiting agent idle past the lifetime.
On GPT-5.6+, also put an explicit breakpoint after the shared instructions when the task
suffix changes.

### What the System Prompts Say

Three sources were compared on 2026-09-16:

- **Claude Code, as reconstructed by a third party.** Anthropic does not publish Claude
  Code’s system prompt [V9]. Piebald-AI maintains a reconstruction of the CLI’s prompts
  as version-tagged template fragments, tracking v2.1.274 at the compared commit [V21].
- **Claude Code, as observed.** One Claude Code desktop-app session’s resolved prompt
  and tool definitions were captured locally (not published) and reviewed [V22].
- **Codex, from source.** Codex’s multi-agent prompts and tool descriptions are open
  source; the files below were read at commit `787823cf` and re-read, unchanged, at
  `b0659c53` on 2026-09-17 [V20].

Where the observed session and the reconstruction overlap (the harness bullets, the
Workflow tool, memory instructions, background-task notifications, and the agent launch
result), the text matches after template variables resolve.
The observed session also carried text the reconstruction does not contain, such as the
prompt-injection safety rules, desktop-app instructions, and the sub-agent report
scanning marker, which likely come from the host application or server; its Agent tool
description was shorter than the reconstruction’s assembled Agent guidance.

**Claude Code delegation rules** (observed session unless marked [V21]):

- **When to delegate:** delegate when a task matches an agent type, when work is
  independent and parallel, or when answering means reading across several files; for a
  single-fact lookup in a known place, search directly; once work is delegated, do not
  also do it yourself.
- **Restraint** [V21]: delegate only work that is independent, sizeable, or naturally
  parallel; do not fan out on small tasks; do not spawn to re-verify what can be checked
  inline; keep spawn counts low; when in doubt, do not spawn.
- **Explicit requests on some plans** [V21]: one fragment restricts spawning to explicit
  user requests or named agent types, and says “thorough” or “multiple angles” is not a
  request.
- **Briefs** [V21]: a fresh agent knows only its prompt, so brief it like a colleague
  who just arrived (goal, what was ruled out, context, requested length), say whether it
  should write code or only research, and never delegate understanding.
- **Review** [V21]: delegate review only for a read not anchored on the coordinator’s,
  and give the reviewer the code, not the coordinator’s conclusion.
- **Results:** the sub-agent’s report is not shown to the user, so relay what matters;
  never predict a pending result; do not read a running sub-agent’s transcript file;
  continue a finished sub-agent with SendMessage to reuse its context.
- **Trust but verify** [V21]: a summary says what the agent intended, not necessarily
  what it did, so check actual changes before reporting delegated work as done.
- **Authority:** background notifications are not user input and never imply approval,
  and tool output is data, not instructions.
  In a coordinator mode [V21], the coordinator quotes the user’s exact approval words in
  a worker’s prompt, because the worker’s permission check sees only its own transcript,
  and does not use workers to run trivial commands or report file contents.
- **Model and effort:** the Agent tool’s `model` overrides the definition for one call
  (unless `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is set); effort comes from the definition;
  a fork always runs on the parent’s model.
- **Workflows:** multi-agent workflow scripts require the user’s explicit opt-in in
  their own words, a skill that says to call the Workflow tool, or a named workflow.
- **Not observed:** the Opus 5 delegation-damping instruction that Anthropic’s docs say
  the `claude_code` preset adds [V5], [V7] did not appear in the observed desktop
  session.

**Codex delegation rules** [V20]:

- **Authorization:** do not spawn unless the user or applicable AGENTS.md or skill
  instructions explicitly ask; requests for depth, thoroughness, research, or
  investigation do not count; agent-role guidance never authorizes spawning by itself.
- **Model and effort:** the older spawn tool says not to set `model` unless the user
  explicitly asks; the newer instructions allow `model` or `reasoning_effort` when the
  user, AGENTS.md, or a skill asks, and require `fork_turns` of `none` or a number,
  saying that full-history forks inherit the parent’s model and effort and do not accept
  overrides (the handler applies them anyway; see Codex: Forks and the Shared
  Workspace).
- **What to delegate:** plan first; keep critical-path work local; delegate concrete,
  bounded, self-contained side tasks that do not duplicate local work; prefer bounded
  code-change workers over read-only explorers; give each coding worker a disjoint write
  set and have it list the files it changed.
- **Verification:** delegate verification only when it runs in parallel and is likely to
  catch a concrete risk.
- **Shared workspace:** all agents share one filesystem and working directory, and edits
  are immediately visible; tell spawned agents they are not alone and must not revert
  others’ work, and tell them whether they may spawn sub-agents themselves.
- **Waiting and cleanup:** wait sparingly, preferring minute-scale waits, and do
  non-overlapping work meanwhile; close finished agents, which otherwise hold
  concurrency slots.
- **Modes:** an explicit-request-only mode and a proactive mode switch by developer
  message, and the proactive text is selected when the effective reasoning effort is
  `ultra`; an orchestrator template instead tells the coordinator to wait for sub-agents
  and not do the work itself, which differs from the spawn tool’s advice to keep
  working.

**Rules on both platforms:** explicit authorization (always on Codex, on some plans in
Claude Code); fresh context rather than forks when choosing a model; self-contained
briefs; not duplicating delegated work; relaying and checking results; cleaning up
finished agents.

**Rules only one platform states:** quoting the user’s exact approval in a brief (Claude
Code coordinator mode); telling sub-agents they share the workspace and whether they may
spawn (Codex); giving reviewers the code rather than a conclusion (Claude Code).

### Claude Code Orchestration Patterns

#### Parallel Surfaces

*(Added 2026-09-16 from Run agents in parallel [V3].)* Claude Code documents four ways
to run work in parallel, plus supporting tools; this document covers the first and third
in depth.

| Approach | What it gives you | Status |
| --- | --- | --- |
| Sub-agents | Delegated workers inside one session, own context, return a summary | Stable |
| Agent view (`claude agents`) | One screen to dispatch and monitor background sessions; a dispatched session moves into its own worktree before editing | Research preview |
| Agent teams | Coordinated sessions with a shared task list and messaging, managed by a lead | Experimental, off by default |
| Dynamic workflows (`/workflows`) | A script that runs many sub-agents and cross-checks their results, for jobs too big for one turn [V4] | Documented |

Supporting tools: worktrees (a separate checkout per session or sub-agent) [V31],
cross-session messaging (Claude messages the user’s other sessions) [V32], and `/batch`
(a packaged skill that splits one large change into 5 to 30 worktree-isolated sub-agents
that each open a PR). The page’s rule of thumb: sub-agents when Claude delegates and
collects inside one conversation; agent view when the user hands off independent tasks;
teams when Claude must plan, assign, and supervise; workflows when a script should hold
the plan.

#### Loops and Iteration

Native sub-agents cannot run in loops by themselves: the Agent tool spawns a sub-agent,
it runs, and it returns a result.
The main agent implements the loop: spawn sub-agent A with a task, read its result,
evaluate, and if the result is unsatisfactory spawn it again or resume it, until done.
Resuming is what makes this work: messaging a finished sub-agent with `SendMessage`
continues it with its full previous context, so it does not lose track of what it was
doing. Dynamic workflows [V4] are the documented way to run a loop that a script, rather
than Claude’s turn-by-turn judgment, controls.

#### Background Sub-Agents

*(Rewritten 2026-09-16 against the sub-agents docs [V1]. The February 2026 text said
results arrive only through an `output_file`, that background sub-agents auto-deny
permission prompts, and that they lose MCP tools; none of that matches the current
docs.)*

Background is now the default: with fork mode on (the default in interactive sessions)
every sub-agent runs in the background and Claude cannot ask for the foreground.
Claude Code picks foreground only when an in-process teammate spawned the sub-agent,
when `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` is set, or, with fork mode off, when
Claude asks for the foreground and the definition does not set `background: true`.

Background sub-agents:

- Run concurrently while the main agent continues.
- Deliver results as a completion notification in a later turn.
  Claude waits for that notification before reporting the sub-agent’s results, and if
  asked about progress first, it reports that the sub-agent is still running.
  The February 2026 `output_file` mechanism is no longer documented; read the transcript
  under `~/.claude/projects/{project}/{sessionId}/subagents/` if raw output is needed.
- Surface permission prompts in the main session (v2.1.186+); a lasting answer applies
  to the whole session.
- Keep MCP tools but get a reduced set of built-in tools (see Context Transfer and
  Forks).
- Cannot ask clarifying questions, because `AskUserQuestion` is removed from every
  sub-agent.
- Can be resumed with `SendMessage` once finished or stopped.
- Cannot outlive an in-process teammate: a teammate’s own sub-agents run in the
  foreground, and a `background: true` definition errors there.

#### Bounding Execution

*(Updated 2026-09-16.)* The February 2026 text described a per-invocation `max_turns`
parameter on the Task tool.
As of 2026-09-16 the documented cap is the definition’s `maxTurns` frontmatter field
(when a sub-agent stops at the limit, its output is marked partial and Claude can
message it to continue, v2.1.246+) and, for `-p` runs, the `--max-turns` and
`--max-budget-usd` flags [V1], [V27]. A per-invocation parameter could not be
re-verified in the tools reference [V30] and is not in the Agent tool schema observed in
a 2026-09-16 desktop session [V22]. Bounding turns prevents runaway sub-agents,
time-boxes exploration, supports work-then-report patterns, and budgets iterations in
orchestration loops (for example 20 to 30 turns per iteration).

#### Agent Teams (Experimental)

*(Re-verified 2026-09-16 against Orchestrate teams of Claude Code sessions [V3]; still
experimental and disabled by default.)*

When sub-agents are insufficient because workers need to communicate with each other,
agent teams provide:

- Shared task lists with self-coordination (for agents that have the Task tools, which
  are available by default only on older model families; others coordinate by message)
- Direct inter-agent messaging (not just report-to-parent)
- Teammates that are full, independent Claude Code sessions, loading `CLAUDE.md`, MCP
  servers, and skills like a regular session, but not the lead’s history
- A team lead that coordinates, assigns tasks, and synthesizes results
- Enablement with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; since v2.1.178 there is no
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

| Aspect | Sub-agents | Agent teams |
| --- | --- | --- |
| Context | Own window, results return to caller | Own window, fully independent |
| Communication | Return a result to the caller; named sub-agents can also message each other (v2.1.206+) | Teammates message each other directly |
| Coordination | Main agent manages all work | Self-coordination by messages, plus a shared task list where the Task tools exist |
| Best for | Focused tasks where only the result matters | Complex work requiring discussion |
| Token cost | Lower (results summarized) | Higher (each teammate is a separate instance) |
| Nesting | Up to 3 layers by default (configurable) | No nested teams; teammates can spawn foreground sub-agents |
| Worktrees | `isolation: worktree` per sub-agent | Not isolated; partition files per teammate |

Documented limits (2026-09-16): no session resumption for in-process teammates, task
status can lag, shutdown can be slow, one team per session, the lead is fixed,
per-teammate permission modes cannot be set at spawn, and split panes need tmux or
iTerm2. The docs suggest starting with 3 to 5 teammates and 5 to 6 tasks per teammate.

#### Custom Sub-Agents, Hooks, and Delegation Control

Custom sub-agents are a first-class extension point: they participate in the same
delegation framework as the built-in ones, and Claude uses each sub-agent’s
`description` field to decide when to delegate, so a well-described custom sub-agent is
invoked for matching tasks [V1]. The flow is: Claude encounters a task, evaluates the
available `description` fields, delegates through the Agent tool if one matches, the
sub-agent runs with its own system prompt, tools, and model, and the result returns to
the caller. Each step can be influenced:

- **Which sub-agents exist:** project definitions in `.claude/agents/` shared by the
  team, personal ones in `~/.claude/agents/`, and sub-agents distributed by plugins.
- **Which sub-agents can be used** (permissions; `Agent(...)` syntax since v2.1.63,
  `Task(...)` kept as an alias): `"permissions": { "deny": ["Agent(Explore)"] }`,
  `--disallowedTools "Agent(my-agent)"`, or denying the `Agent` tool itself to stop all
  delegation.
- **What happens around delegation** (hooks; re-verified 2026-09-16 [V29]):
  `SubagentStart` fires when any sub-agent begins, with a matcher on `agent_type` (the
  definition’s `name`); `SubagentStop` fires when any sub-agent completes, and a `Stop`
  hook written in a sub-agent’s frontmatter is converted to `SubagentStop`; `PreToolUse`
  and `PostToolUse` hooks run inside sub-agents before and after tool calls.
  Hooks in a definition’s `hooks` field are ignored for plugin sub-agents.

A definition with hooks that enforce validation:

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

The same lifecycle can be hooked from settings, with `SubagentStart` and `SubagentStop`
entries whose `matcher` is the definition name (for example a stash before
`guarded-coder` starts and a validate-and-format script when it stops).

**A pipeline of specialists.** Several definitions (a read-only `researcher` on `haiku`,
a read-only `planner` on `opus`, an `implementer` with full tools on `opus`, a read-only
`reviewer` on `sonnet`, a Bash-only `test-runner` on `haiku`) plus a `CLAUDE.md`
instruction to use them in order gives a pipeline that the main agent, or a coordinator
sub-agent, chains.

**Restricting what a coordinator may spawn.** When Claude runs as a named agent with
`claude --agent coordinator`, its definition can carry
`tools: Agent(researcher, implementer, reviewer), Read, Bash`; the parenthesized list is
an allowlist, and the agent sees only those types in its prompt.
This restriction applies only to agents running as the main thread with `--agent`. In an
ordinary sub-agent definition, listing `Agent` in `tools` lets the sub-agent spawn its
own sub-agents up to the depth limit, and the type list in parentheses is ignored [V1]
(re-verified 2026-09-16).

**Limits of custom delegation.** There is no custom delegation logic: the decision is
Claude’s interpretation of `description` fields, not rule-based, and no function can
override it.
Sub-agents report to the agent that launched them; named sub-agents can also
message each other with `SendMessage` (v2.1.206+), but there is no shared task list
without agent teams *(corrected 2026-09-16)*. Nesting is bounded at three layers by
default and results flow back to the launcher, so a deep pipeline still needs the
coordinator to collect them *(corrected 2026-09-16; the February 2026 text said nesting
was impossible)*. Hooks run shell commands and use exit codes to allow or block; they
cannot modify a sub-agent’s prompt or tools dynamically.
For fully custom delegation logic, use the `claude -p` outer loop (next section), where
the outer instance can ask for a structured decision (`--output-format json` with
`--json-schema`) and invoke the right specialist with its own model and prompt.

#### Comparison: Native Sub-Agents, Agent Teams, and the Outer Loop

*(Updated 2026-09-16; the February 2026 rows for model control, inter-agent
communication, and nesting depth were stale.)*

| Dimension | Native sub-agents | Agent teams (experimental) | Outer loop (`claude -p`) |
| --- | --- | --- | --- |
| Setup complexity | Low (built-in) | Medium (experimental flag) | High (custom orchestration) |
| Model control | Per-call `model`; definition `model` and `effort`; env var as fallback or forced | Spawn prompt or definition model; effort inherited from the lead | Full CLI control (`--model`, `--effort`) |
| Context isolation | Full (fresh context plus `CLAUDE.md`), unless forked | Full | Full |
| Inter-agent comms | Report to parent; named sub-agents can message each other | Direct messaging and shared task list | Via files and handoff docs |
| Nesting depth | 3 layers by default (configurable) | No nested teams; teammates may spawn foreground sub-agents | Unlimited |
| Parallelism | Background by default in interactive sessions | Native (in-process, tmux, or iTerm2) | Shell backgrounding |
| Custom compaction | No | No | Yes (explicit handoffs) |
| Session persistence | Sub-agent transcripts (resumable in the same session) | Teammate transcripts; in-process teammates not restored by `/resume` | Full session persistence |
| Token efficiency | Each sub-agent warms its own prefix, separate from the parent’s; same-definition spawns in one directory share it within the TTL (see Caching From First Principles) | Each teammate is a separate instance with its own prefix | Each invocation has its own prefix; invocations in one directory share it within the TTL [V39] |
| Maturity | Stable | Experimental, disabled by default | DIY (all stable primitives) |
| Permission control | Inherited plus overrides | Inherited from the lead at spawn | Fully independent |

### Claude Code Invoking Claude Code: Outer Loops and the Agent SDK

*(The archived orchestration brief covers the protocol view of instance-from-instance
orchestration: the Agent SDK, the `--sdk-url` WebSocket protocol, and ACP as alternative
control surfaces.)*

#### The Pattern

The “Ralph Wiggum loop” (or outer-loop pattern) has Claude Code invoke another Claude
Code instance as a subprocess through the Bash tool, using the `-p` (print,
non-interactive) flag [V28], [V35]:

```bash
claude -p "Analyze auth.py and fix security issues" \
  --allowedTools "Read,Edit,Bash" \
  --output-format json
```

This differs from native sub-agents on every axis:

| Aspect | Native sub-agent (Agent tool) | Claude via Bash (`claude -p`) |
| --- | --- | --- |
| Context isolation | Fresh context (plus `CLAUDE.md`), unless forked | Complete isolation (fresh process) |
| Model control | Per-call `model`, definition `model` and `effort`, env var | Full CLI flag control (`--model opus --effort xhigh`) |
| System prompt | Sub-agent definition only | Full customization (`--append-system-prompt`; see the flag note below) |
| Tool access | Configured in the sub-agent definition | `--allowedTools`, `--disallowedTools` |
| Session persistence | Transcript in the sub-agent directory | Optional (`--session-id`, `--continue`) |
| Output format | Returns to the parent via the Agent tool (completion notification when in the background) | stdout (text, json, stream-json) |
| Compaction | Built-in auto-compaction | Built-in auto-compaction |
| Cost | Own prefix cache per sub-agent, separate from the parent’s (see Caching From First Principles) | Own prefix per invocation; parallel invocations in one directory share it within the TTL [V39] |
| Nesting | Up to 3 layers by default (configurable) | Arbitrarily deep |
| Permission | Inherits from the parent plus sub-agent config | Fully independent permission mode |
| MCP servers | Inherits from the parent; a definition can scope its own `mcpServers` | Must be configured independently |
| Background execution | `run_in_background` parameter | Shell backgrounding (`&`, etc.) |

**Advantages of the outer loop:** arbitrary nesting; every CLI flag (`--model`,
`--append-system-prompt`, `--allowedTools`, `--max-turns`, `--max-budget-usd`,
`--json-schema`); complete isolation with no context pollution; session continuity
through `--session-id`, `--continue`, and `--resume` for explicit compaction boundaries;
validated structured output with `--output-format json` and `--json-schema`; a hard
spend cap per invocation.

**Disadvantages:** higher latency (each invocation starts a process, loads
configuration, and connects); no shared context, so everything crosses through prompts,
files, or pipes; no cache sharing with the outer session (invocations in one directory
can share a prefix with each other within the TTL); process lifecycle, error recovery,
and output parsing to manage; and no automatic resume, so if the outer agent compacts it
loses track of inner invocations unless state is persisted to files.

#### Custom Compaction and Handoff Cycles

The most interesting application: the outer instance spawns an inner instance with a
task and a context file; the inner instance works until its turn or budget limit, writes
a handoff document, and exits; the outer instance reads the handoff, decides whether to
continue, and if so spawns the next inner instance with the updated context.

```bash
claude -p "$(cat .handoff/task.md)" \
  --model opus \
  --allowedTools "Read,Grep,Glob,Bash,Edit,Write" \
  --append-system-prompt "When you finish or hit limits, write a handoff \
    document to .handoff/current.md describing: what you did, what remains, \
    key findings, and recommended next steps." \
  --max-turns 20 \
  --output-format json > .handoff/result-1.json

# Next iteration: continue from the handoff
claude -p "Continue the work described in this handoff: $(cat .handoff/current.md)" \
  --model opus --allowedTools "Read,Grep,Glob,Bash,Edit,Write" --max-turns 20
```

Session continuity is an alternative to handoff files: the first invocation returns a
`session_id` in its JSON output; `--resume "$session_id"` continues that session with
its full history, and `--resume "$session_id" --fork-session` starts a new session ID
that inherits the history up to the fork point, for trying an alternative approach.

A full outer loop plans (with plan mode or a planning sub-agent), executes each phase
through `claude -p` with a phase-specific prompt, context from earlier phases in files,
turn and budget limits, and structured output requirements, then reads the output and
handoff, decides whether to continue, retry, or finish, and writes orchestration state
to files rather than keeping it in context.
Each inner invocation gets a fresh context window, the handoff provides curated context
(better than auto-compaction), phases can use different models and prompts, and state
survives even if the outer agent compacts; the costs are setup and debugging complexity,
no cache shared with the outer session, process startup latency, careful handoff design,
and the fact that the outer agent itself eventually hits context limits.

#### What Exists Today

All the pieces exist on the CLI [V27], [V28]:

1. `claude -p` for non-interactive invocations.
2. `--model`, `--effort`, and `--fallback-model` per invocation (verified 2026-09-16).
3. `--append-system-prompt` for custom prompts.
   *(2026-09-16: `--system-prompt` and `--system-prompt-file` were not found on the CLI
   reference; the listed flags are `--append-system-prompt`,
   `--append-subagent-system-prompt`, and `--append-subagent-system-prompt-file`, so any
   example that uses `--system-prompt` should be checked against `claude --help` before
   use.)*
4. `--max-turns` and `--max-budget-usd` for bounded execution.
5. `--output-format json` with `--json-schema` for structured output.
6. `--resume`, `--continue`, and `--fork-session` for session continuity.
7. `--allowedTools` for per-invocation tool control.
8. `--agents` for per-invocation custom sub-agents.
9. The Bash tool for invoking `claude -p` from within Claude Code.

#### The Claude Agent SDK

The Claude Agent SDK (Python and TypeScript) gives programmatic control over the same
primitives [V33]. *(Updated 2026-09-16: the packages were renamed from the Claude Code
SDK to the Claude Agent SDK; the Python repository is
`anthropics/claude-agent-sdk-python` and the docs include a migration guide.
The SDK supports sub-agents with depth, concurrency, and spend caps [V5].)* Fork mode is
off in the SDK unless turned on (see Forks).

```python
# PSEUDOCODE: illustrates the concept, not the exact API.
# Real SDK: `pip install claude-agent-sdk`; see the Python reference for entry points.

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

### Compaction and Self-Managed Handoff (Claude Code)

Auto-compaction degrades quality progressively, and there is no built-in way for an
agent to “kill itself and rejuvenate” with a clean context window.
This section covers every available mechanism for an agent to manage its own context
lifecycle. The pattern that works best: the agent writes a structured handoff, then a
fresh instance picks it up with a clean context window.
Memory persists not in the model’s context but in the filesystem: git commits, handoff
files, tbd issues. Each fresh instance reads the current state, does one unit of work,
and writes updated state.

*(Verification status, 2026-09-16. Re-verified: `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` exists
and applies to sub-agents as well as the main conversation [V26]; the `PreCompact`
(matchers `manual` and `auto`), `SessionStart` (matcher `compact` among others), `Stop`,
`SubagentStart`, and `SubagentStop` hook events exist, `prompt`-type hooks are
supported, and a `PostCompact` event now exists too [V29]; `/compact` accepts focus
instructions and `/context` works in cloud sessions [V25], [V34]. Not re-verified: the
~95% trigger figure and buffer sizes, the status of issue #15174 [V37], the third-party
handoff tools [V36], and the practitioner cost figures.
Nothing in this section was changed on that basis; treat those details as February 2026
observations.)*

#### The Problem with Auto-Compaction

Built-in auto-compaction triggers at about 95% of context capacity, summarizes the
conversation with an LLM call, and continues with the summary [V34]. Known problems:

1. **Progressive context loss.** Each compaction summarizes the summary; by the second
   or third compaction, critical decisions, failed approaches, and nuanced understanding
   are typically gone.
2. **Late trigger.** At 95% capacity, model performance is already degraded.
   Practitioners recommend treating 70% as the practical ceiling.
3. **Not task-aware.** Compaction fires on token count, not at semantic boundaries such
   as the end of a phase.
4. **Infinite compaction loops.** A known bug where Claude Code cycles between
   compaction and work.
5. **Buffer overhead.** Claude Code reserves roughly 33K to 45K tokens as buffer, so
   usable context is less than the raw 200K.

`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` (for example `"70"` in a settings `env` block)
triggers compaction earlier; verified 2026-09-16, it accepts 1 to 100, can only lower
the threshold, applies to sub-agents too, and is set by cloud sessions themselves, which
override any value in the environment’s variables [V26]. `/compact` accepts focus
instructions, for example
`/compact focus on the authentication refactoring decisions and failed approaches`.

#### Approach 1: tbd Agent Handoff (Simplest)

`tbd shortcut agent-handoff` generates a structured handoff prompt for the next agent:
task and spec context; current branch, PR, and CI status; tbd issue IDs and statuses;
failed approaches and key decisions; non-obvious setup requirements.
The agent detects it is getting long or complex, runs the shortcut, and the user pastes
the output into a new session, which starts fresh with full context.
Always run `tbd sync` before generating the handoff so issue state is pushed.
The handoff is curated: it captures what matters, not a generic summary, and failed
approaches (the most valuable information) are explicitly preserved.

#### Approach 2: Outer Loop with `claude -p` (Semi-Autonomous)

The agent spawns a fresh Claude Code instance through the Bash tool; the current session
blocks on the call until the subprocess finishes, then continues:

```bash
claude -p "$(cat .handoff/current.md)" \
  --model opus \
  --allowedTools "Bash,Read,Edit,Write,Glob,Grep" \
  --max-turns 30 \
  --max-budget-usd 5.00
```

Useful flags: `--output-format json` (session ID and metadata back), `--max-turns N` and
`--max-budget-usd N` (budget the phase), `--append-system-prompt` (inject handoff
instructions), `--session-id UUID` (control session identity), and
`--no-session-persistence` (throwaway work) [V27]. The subprocess is fully independent,
with its own context window, model, and permissions; the old session does not terminate
itself, so this is not a true self-restart, but the effective behavior is the same: work
transfers to a fresh context.
True self-termination needs the shell-script loop (Approach 4).

#### Approach 3: Session Chaining with `--continue` and `--resume`

`claude -c -p "Now fix the remaining test failures"` continues the most recent session;
`claude -r "<id>" -p "..."` resumes a specific one; `--resume "<id>" --fork-session`
forks it into a new session ID that inherits the history up to the fork point.
These reload the full conversation history, which is not compaction: they carry the full
context and can hit `prompt_too_long` if the session was already near its limits.
Use `--continue` when context is still manageable and continuity matters; use a handoff
(fresh `-p`) when context is bloated and a clean restart with curated state is wanted.

#### Approach 4: Ralph Loop Shell Script (Fully Autonomous)

A shell script runs `claude -p` in a loop, and each iteration gets a fresh context
window; state persists in the filesystem, not in the model’s memory [V35]:

```bash
#!/bin/bash
# ralph-loop.sh: autonomous compaction via iteration

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

  if head -1 "$STATE_FILE" 2>/dev/null | grep -q "DONE"; then
    echo "Task completed in $i iterations"
    break
  fi

  git add -A && git commit -m "ralph loop: iteration $i" --no-verify 2>/dev/null
done
```

Design principles: state lives in files, not context; one unit of work per iteration; a
git commit between iterations as a safety net and audit trail; a budget limit per
iteration. A team at a YC hackathon used this pattern to produce 1,100+ commits across
six repositories overnight for about $800 ($10.50 per hour per agent) *(February 2026
practitioner figure, not re-verified)*.

#### Approach 5: Hooks-Based Compaction Management

Hooks [V29] can automate parts of the compaction lifecycle.
A `PreCompact` hook can back up the transcript before compaction runs:

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

A `SessionStart` hook with the `compact` matcher that prints `.handoff/current.md` is
meant to inject the handoff after compaction, but a known bug (issue #15174 [V37]) means
the hook runs while its stdout may not be injected into context, so the pattern can
silently fail; test it before relying on it, and prefer the `PreCompact` backup.
A `Stop` hook of type `prompt` can force a handoff before the session ends, for example
“Before stopping: update .handoff/current.md with current state, run tbd sync, and
commit the handoff file.”
(this project’s `.claude/settings.json` configures `PreCompact` and `SessionStart`
hooks; see Next Steps for the `Stop` hook).

#### Approach 6: Git-Based Handoff (Cross-Device, Cross-Agent)

The agent writes handoff state to a git-tracked file such as `.handoff/current.md`
(phase, completed work, work in progress, failed approaches, key decisions, next steps),
commits, and pushes; any later session, local or cloud, on any machine, picks it up with
`git pull` and `claude -p "Read .handoff/current.md and continue the task."`. It is
durable (survives VM teardown), auditable (git log), and crosses the cloud and local
boundary; the cost is commit noise, so keep a `.handoff/` directory and consider
squashing handoff commits later.

#### Approach 7: tbd Handoff Integration (Recommended for This Project)

Combining tbd’s issue tracking with structured handoffs is the most robust pattern for
this project: the agent works on tbd issues; when it approaches context limits (or a
human decides it is time), it runs `tbd shortcut agent-handoff`, then `tbd sync`,
commits any work in progress plus the handoff file, and pushes; the new session reads
`.handoff/current.md`, runs `tbd prime` (restores tbd context) and `tbd ready` (sees
what to work on), and continues.
This is strictly better than auto-compaction: the handoff is curated, failed approaches
are captured, tbd issues provide structural continuity across sessions, git provides a
safety net and audit trail, and it works across the cloud and local boundary.

#### Approach 8: Bead-Managed Loop (Structured Iteration via Issue Tracking)

The most structured variant of the Ralph Loop uses tbd beads to track each iteration as
a separate issue, with parent-child relationships providing an audit trail and
structured context for the next agent.
A parent bead represents the overall task; each iteration creates a child bead, runs
`claude -p` with a prompt that tells the agent to read the recent closed child beads, do
one unit of work, and close its child bead with
`tbd close <id> --reason 'Did X. Result: Y. Next: Z.'` (closing the parent too when the
whole task is done); the script then runs `tbd sync`, checks whether the parent bead is
closed, and commits and pushes between iterations.
The next agent reads the recent beads, not all of them, to understand state and
trajectory, without relying on context-window memory at all.

Why this is powerful: each bead is a structured, curated record of what was attempted,
what worked, and what failed; the chain is the memory, and it survives compaction,
crashes, VM teardowns, and cloud-to-local crossings because it is git-native; each bead
close is a clean checkpoint, so a problem can be traced to the iteration that introduced
it; and sequential dependencies among child beads let `tbd ready` surface the next step.
After five iterations the chain looks like this:

```
ar-k8m2  [open]     "Refactor auth module to use JWT"
  ├── ar-m3n1  [closed]  "Iteration 1: Analyzed current auth code, identified 3 modules"
  ├── ar-p4q2  [closed]  "Iteration 2: Created JWT token service, wrote tests"
  ├── ar-r5s3  [closed]  "Iteration 3: Migrated login endpoint, tests passing"
  ├── ar-t6u4  [closed]  "Iteration 4: Migrated registration endpoint, found edge case"
  └── ar-v7w5  [in_progress]  "Iteration 5: Fix edge case in token refresh"
```

A tbd-native orchestrator (a hypothetical
`tbd loop <parent> --max-iterations 50 --model opus --budget-per-iteration 3.00 --prompt-file .handoff/task.md`,
not implemented) could create the child beads, build each prompt from the parent and
recent children, spawn `claude -p`, close the child with the agent’s summary, check the
parent, and sync and push between iterations, removing the shell script.

| Aspect | Plain Ralph Loop | Bead-managed loop |
| --- | --- | --- |
| State format | Free-form text file | Structured beads with metadata |
| History | Single state file (overwritten) | Full chain of closed beads |
| Audit trail | Git commits only | Beads plus git commits |
| Searchable | `grep` through the state file | `tbd search`, `tbd show` |
| Resumable | Read the state file | `tbd ready` surfaces the next step |
| Cross-agent | Must share a file path | `tbd sync` shares everywhere |
| Rollback | `git revert` | Close or reopen beads, `git revert` |
| Visibility | Log file | `tbd list` shows all iterations |

Use the plain Ralph Loop for quick, low-ceremony autonomous work; use the bead-managed
loop for full traceability, when several people or agents may inspect progress, or when
iterations are complex enough that a one-line state file is not sufficient.

#### Token Budget Awareness

Can an agent detect when it is approaching context limits?
System-level warnings with the remaining token count are injected into context when
usage is high; `/context` shows the usage breakdown in interactive mode [V34];
`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` moves compaction earlier; and sub-agents have their
own context, so offloading work to them reduces main-context pressure.
There is no programmatic API for an agent to query its own token usage, and it cannot
invoke `/compact` programmatically.
The closest workaround: set `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=70`, configure a
`PreCompact` hook to back up state, and a `SessionStart(compact)` hook to inject the
handoff after compaction (subject to the bug noted above).

#### Decision Matrix: Which Approach to Use

| Approach | Complexity | Context quality | Autonomy | Cloud? | Best for |
| --- | --- | --- | --- | --- | --- |
| `/compact` (built-in) | None | Low to medium | Automatic | Yes | Quick extension of a session |
| `tbd agent-handoff` | Low | High | Manual | Yes | Structured team and project handoffs |
| `claude -p` from a session | Medium | High | Semi-auto | Local only | Agent-initiated fresh start |
| `--continue` or `--resume` | Low | Full (risky) | Manual | Yes | Quick session pickup |
| Ralph Loop script | High | High | Fully auto | Local only | Long autonomous multi-phase work |
| Bead-managed loop | High | Highest | Fully auto | Yes (see note) | Traceable multi-phase work with a full audit trail |
| Hooks (pre- and post-compact) | Medium | Medium to high | Automatic | Yes | Augmenting auto-compaction |
| Git-based handoff | Medium | High | Semi-auto | Yes | Cross-device, cross-agent work |
| tbd handoff plus git | Medium | Highest | Semi-auto | Yes | This project specifically |

Note on the bead-managed loop: the shell orchestrator runs locally, but beads sync via
git so progress is visible everywhere; a tbd-native orchestrator could run in any
environment.

### How tbd Applies These Findings

The normative text is the
[PR Review Lifecycle and Sub-Agent Delegation plan](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md)
(a draft as of 2026-09-16), implemented on 2026-09-17 as the `delegate-to-subagents` and
`review-and-merge-prs` shortcuts and the `agent-model-tiers` and `agent-policy-grants`
guidelines. Where this summary and the plan differ, the plan wins.
The two sections after this one compare the written documents with the vendor guidance
recommendation by recommendation.
In brief, the plan applies the findings above as follows:

- **Coordinator and roles.** The user’s session coordinates and never changes the shared
  tree while a sub-agent works in it; a strong-tier reviewer publishes one senior
  review, a moderate-tier addressing agent is the sole committer on the PR branch, and a
  fast-tier administrator does CI waits and bookkeeping
  ([Roles](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md#roles)).
- **Model tiers.** Tiers are defined by model rank and reasoning level within the
  provider, not by model name; on Claude Code the model is named on every spawn and the
  reasoning level needs a predefined agent with an `effort` field, so `tbd setup` is to
  generate one `.claude/agents/tbd-*.md` definition per tier and level (plus matching
  `.codex/agents/tbd-*.toml` files), and tier work starts in a fresh, named sub-agent,
  never a fork
  ([Model Tiers](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md#model-tiers),
  [Tier Agent Definitions](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md#tier-agent-definitions)).
- **Authorization.** tbd encourages sub-agents but delegates only under an explicit
  `subagents` grant recorded in a policy block in `AGENTS.md`, which also serves as the
  explicit authorization Codex requires; a request for depth or thoroughness is not
  authorization, and a grant never bypasses a tool permission or sandbox
  ([Policy Grants](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md#policy-grants),
  [Agent Policy Grants](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md#agent-policy-grants),
  [Sub-Agent Authorization](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md#sub-agent-authorization)).
- **Briefs and verification.** Every brief is self-contained (pinned inputs as paths and
  IDs, the role’s boundaries, the user’s exact authorization, the report fields needed)
  and adds no self-check instructions; the coordinator verifies every claim against
  GitHub, git, CI, and beads, and the review header records the *requested* tier, model,
  and level because a sub-agent cannot reliably report its own
  ([Delegation Procedure](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md#delegation-procedure)).
- **Trees and concurrency.** One tree by default, with the reviewer and addressing agent
  in sequence; a worktree per PR when several PRs are handled at once, and merges one at
  a time; on Claude Code `isolation: worktree` starts from the default branch, so a
  worktree sub-agent checks out the PR branch first; the coordinator keeps few
  sub-agents running and closes finished ones
  ([Delegation Procedure](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md#delegation-procedure),
  [Orchestrated Workflow](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md#orchestrated-workflow)).
- **Single-agent fallback.** Without sub-agents, one session performs every step with
  the same artifacts, and says when a review of its own fixes is not independent
  ([Single-Agent Fallback](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md#single-agent-fallback)).
- **Codex.** The same workflow runs on Codex with per-spawn `model` and
  `reasoning_effort`, `.codex/agents/*.toml` definitions, a shared checkout (so parallel
  PRs need a `git worktree` per PR), and the recorded grant as its explicit
  authorization; a coordinator delegates within its own platform
  ([Sub-Agent Platforms and Vendor Guidance](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md#sub-agent-platforms-and-vendor-guidance)).

### Classification of Vendor Recommendations

*(Added 2026-09-17, bead `tbd-ycxf`.)* A strong-tier review compared every
recommendation in Vendor Guidance, What the System Prompts Say, and Key Insights with
the written shortcuts (`delegate-to-subagents`, `review-and-merge-prs`,
`pr-review-workflows`, `review-github-pr`, `address-pr-review`, `review-code`, and the
dedicated review shortcuts) and guidelines (`agent-model-tiers` and
`agent-policy-grants`). Status values: *followed*, with where; *deviated*, meaning a
deliberate choice recorded in Deviations From Vendor Guidance below; and *missed*,
applied on 2026-09-17 unless the row says otherwise.
Section names without a document name refer to `delegate-to-subagents`. The general
advice was consolidated into that shortcut’s When to Delegate, Wait and Continue, and
Verify Every Claim sections on the same date, and the review shortcuts now link to it
instead of repeating it.

| Recommendation | Sources | Status | Where |
| --- | --- | --- | --- |
| **Anthropic** |  |  |  |
| Delegate self-contained work that returns a summary, verbose or high-volume operations, and structurally bounded work; stay in one conversation when phases share context, the work needs back-and-forth, the change is small, or latency matters | [V1], [V3] | Missed; applied | When to Delegate |
| Chain sub-agents in sequence for multi-step work | [V1], [V3] | Followed | Reviewer, then addressing agent (`review-and-merge-prs` steps 2 and 3) |
| Run parallel research or reviewers and synthesize | [V3], [V10], [V19] | Deviated | Deviations, row 6 |
| Specialize each sub-agent with a focused prompt and a detailed `description`; preload skills; enable memory | [V1], [V3] | Deviated | Deviations, row 8 |
| Limit a reviewer’s tools; allowlists are structural, not advisory | [V1], [V3] | Deviated | Deviations, row 1 |
| Resume a sub-agent with `SendMessage` rather than starting fresh | [V1] | Followed | Wait and Continue; Handle Failure |
| Tell Opus 5 which scenarios warrant delegation, with deterministic caps | [V7], [V8] | Followed; caps added | Roles in `pr-review-workflows`; When to Delegate (sizing and counts) |
| Keep counts small: teams of 3 to 5, depth and concurrency caps | [V1], [V3], [V19] | Missed; applied | When to Delegate (sizing and counts) |
| Briefs carry paths, errors, and decisions, with an objective, an output format, tool guidance, and boundaries | [V5], [V10] | Followed | Write a Self-Contained Brief |
| Condensed reports of roughly 1,000 to 2,000 tokens | [V12] | Followed; a size added | Brief (Report); `review-github-pr` step 12; `address-pr-review` step 10 |
| Evidence over assertions; a fresh-context reviewer with the diff and the criteria; audit progress claims against tool results | [V2], [V8], [V11] | Followed | Verify Every Claim; the reviewer brief carries the code, not conclusions; follow-up rounds use a fresh reviewer |
| Ask reviewers for every finding and filter afterwards; keep the criteria concrete | [V2], [V7] | Followed | Review Coverage and Rounds in `pr-review-workflows`; `review-code` step 9 with `code-review-rules` |
| Do not add “verify your work” instructions | [V7] | Followed | Brief, last paragraph |
| **OpenAI** |  |  |  |
| Spawn only on explicit authorization; thoroughness is not a request | [V13], [V16], [V20] | Followed | Check Authorization; `agent-policy-grants` |
| Keep critical-path work local and the main agent on the core problem; delegate bounded side tasks that run alongside | [V14], [V16], [V20] | Deviated | Deviations, row 2 |
| Give coding workers disjoint write sets, tell them they are not alone, and have them list the files they changed | [V16], [V20] | Followed | Split the Work by Role and Order; Brief (Boundaries, Report) |
| Wait sparingly; close finished agents | [V16], [V20] | Followed; short-interval waiting added | Wait and Continue; Clean Up |
| Sub-agents suit read-heavy parallel work; avoid multi-agent work when steps chain or contend for shared state | [V13], [V15] | Deviated | Deviations, row 3 |
| Agents-as-tools keep control with the orchestrator; handoffs transfer the conversation | [V15] | Followed | The coordinator never hands off the conversation |
| Choose effort by task, establish a baseline, and raise it only on measured gains; `max` is not a global default | [V14] | Deviated | Deviations, row 4 |
| Tell Astra to delegate whenever parallel work saves time or improves quality | [V18] | Followed | The `subagents` grant plus the shortcut is that standing instruction |
| Set `fork_turns` to `none` or a number when choosing a tier | [V16], [V38] | Followed | Assign Tiers and Spawn (Codex) |
| Lighter models for lighter sub-agent work; a custom agent file’s model and effort take precedence over the spawn | [V13] | Deviated on models (Deviations, row 5); followed on precedence | `agent-model-tiers`; Assign Tiers and Spawn (Codex) |
| Cost: 3 to 15 times one agent; smaller models and `low` effort for simple stages; cap turns and spend | [V4], [V6], [V10], [V11] | Followed on cost; smaller models are Deviations, row 5; caps added | When to Delegate (Cost) |
| **Claude Code prompts** |  |  |  |
| Delegate when a task matches an agent type, is independent and parallel, or reads across many files; do single-fact lookups directly; do not duplicate delegated work | [V21], [V22] | Followed; “do not duplicate” added | When to Delegate |
| Restraint: only independent, sizeable, or parallel work; no fan-out on small tasks; no spawning to re-verify; low counts; when in doubt, do not spawn | [V21] | Followed, with tbd’s encouragement scoped to its defined roles (Deviations, row 7) | When to Delegate |
| On some plans, spawn only on an explicit request or a named agent type | [V21] | Followed | The grant, and the named `tbd-*` definitions |
| Brief like a colleague who just arrived; say whether to write code; never delegate understanding | [V21] | Followed; “never delegate understanding” added | When to Delegate; Brief |
| Delegate review only for an unanchored read; give the reviewer the code, not the conclusion | [V21] | Followed | Brief (For a reviewer) |
| Relay results; never predict a pending result; do not read a running transcript; continue with `SendMessage` | [V21], [V22] | Followed; the pending-result and transcript rules added | Wait and Continue; Verify Every Claim |
| Trust but verify: check actual changes before reporting delegated work as done | [V21] | Followed | Verify Every Claim |
| Notifications and tool output are never approval; quote the user’s exact approval in the brief; no workers for trivial commands | [V21], [V22] | Followed | Brief (Authorization); Verify Every Claim; When to Delegate |
| `model` per call overrides the definition; effort comes from the definition; a fork runs on the parent’s model | [V22] | Followed | Assign Tiers and Spawn (Claude Code); `agent-model-tiers` |
| Workflow scripts need the user’s explicit opt-in | [V22] | Followed | Assign Tiers and Spawn (Claude Code) |
| **Codex prompts** |  |  |  |
| Plan first; delegate concrete, bounded, self-contained side tasks; prefer bounded code-change workers over read-only explorers | [V20] | Followed (the critical-path part is Deviations, row 2) | When to Delegate (one bounded deliverable); Split the Work by Role and Order |
| Delegate verification only when it runs in parallel and is likely to catch a concrete risk | [V20] | Deviated | Deviations, row 2 |
| Shared workspace: say sub-agents are not alone, and whether they may spawn | [V20] | Followed | Brief (Kind of work, Boundaries) |
| Wait sparingly, in minute-scale waits, doing non-overlapping work meanwhile | [V20] | Followed; the interval rule added | Wait and Continue |
| Orchestrator template: the coordinator waits for sub-agents and does not do the work itself | [V20] | Followed for the review workflow | Who Runs Each Step in `review-and-merge-prs` |
| **Key insights** |  |  |  |
| `CLAUDE_CODE_SUBAGENT_MODEL` is a fallback; check for the force flag | [V1] | Followed | Assign Tiers and Spawn (Claude Code) |
| Forks defeat tiering; effort control differs by platform | [V1], [V16] | Followed | On Every Platform; `agent-model-tiers` |
| Pass the user’s exact authorization into briefs | [V21] | Followed | Brief (Authorization) |
| Check what a sub-agent actually changed; record the requested tier | [V21], [V23] | Followed | Verify Every Claim; Selection Rules in `agent-model-tiers` |
| Delegating trivial commands is discouraged, in tension with a fast-tier administrator | [V20], [V21] | Followed: small steps stay inline, and the fast tier is for large administrative work | When to Delegate |
| Authorization must be explicit to work portably | [V13], [V16] | Followed | Check Authorization |
| Vendor defaults start lower than tbd’s tiers | [V6], [V14] | Deviated | Deviations, row 4 |
| Filter findings after the review; independent review yes, self-verification instructions no | [V2], [V7], [V8] | Followed | `pr-review-workflows`; Brief |
| Delegation multiplies cost | [V10], [V11] | Followed | When to Delegate (Cost) |
| Self-managed compaction beats auto-compaction |  | Followed through `agent-handoff`; a pointer added | Wait and Continue |
| Explore no longer runs on a small model | [V1] | Not a recommendation; nothing to apply |  |

Of the 50 rows, 38 are followed (9 of them gained a missing detail on 2026-09-17), 9
deviate deliberately (mapping to 8 deviations below), 2 were missed and applied, and 1
does not apply.

### Deviations From Vendor Guidance

Each row is a deliberate choice.
The plan’s Requirements section records the user decisions cited, and the named shortcut
or guideline states the reason where an agent following it would otherwise be surprised.
Rows 1, 2, 4, 5, 6, and 7 would change a user decision if adopted, so they were not
applied; rows 3 and 8 are design choices that can be revisited without one.

| Recommendation | tbd’s choice | Reason | Sources |
| --- | --- | --- | --- |
| 1. Restrict a reviewer’s tools structurally (no Write or Edit); allowlists are structural, not advisory | Reviewers follow their brief in the shared tree with a writer’s tools, may run tests, and leave the tree as they found it | User decision: no enforced read-only mode, and the reviewer is encouraged to run tests to uncover bugs, which needs the same tools as a writer; the sole-committer rule carries the restriction (`delegate-to-subagents`, Split the Work by Role and Order) | [V1], [V3]; plan Requirements (reviewer setup) |
| 2. Keep critical-path work local, delegate bounded side tasks that run alongside, and delegate verification only when it runs in parallel and is likely to catch a concrete risk | The review and the fix, which are the critical path, each run in a fresh sub-agent in sequence while the coordinator waits; the coordinator keeps preparation, the round decision, the merge gate, and the merge | User decision: one sub-agent reviews and a second addresses; a fresh-context review at the strong tier cannot run in the coordinator’s own session; Anthropic recommends fresh-context verifiers, and Codex’s own orchestrator template takes the same waiting-coordinator position (`review-and-merge-prs`, Who Runs Each Step) | [V13], [V14], [V16], [V20]; the other position in [V2], [V8], and the orchestrator template in [V20]; plan Requirements (example request) |
| 3. Sub-agents suit read-heavy parallel work better than write-heavy coordinated work; avoid multi-agent work when steps chain or contend for shared state | The addressing agent writes, and the steps chain (review, then fix) through published artifacts in one tree | One committer per branch and one tree mean nothing contends; the review and the disposition reply are the coordination, so each step is a bounded task with a clean handoff (`delegate-to-subagents`, Split the Work by Role and Order) | [V13], [V15]; plan Roles |
| 4. Start effort at `high` or a measured baseline and raise it only on measured gains; `max` is not a global default; `low` effort for simple sub-agents | strong and moderate run at the top two levels; fast runs the next-tier model at middle levels; `max` is reserved for the harder strong-tier work (`tbd-strong-max`) | User decision: delegated agents work from a brief alone, so the plan trades tokens for capability; no evaluation baseline exists yet for these shortcuts (`agent-model-tiers`, The Tiers) | [V6], [V14]; plan Requirements (model tiers) |
| 5. Lighter models for lighter sub-agent work (Terra or Luna, Sonnet workers, Haiku exploration) | The fast tier stays on the next-tier model | User decision: a delegated agent works only from its brief (`agent-model-tiers`, The Tiers) | [V4], [V10], [V13]; plan Requirements (model tiers) |
| 6. Fan out parallel researchers or reviewers and have a lead synthesize | One senior review per round with one publisher; dedicated reviews by sensitive area, run in sequence; parallel work only across PRs in separate worktrees | User decision: one review round by default and dedicated reviews by area rather than a panel; reviewers run tests, and two test runs in one tree overwrite each other (`review-and-merge-prs`, step 2) | [V3], [V10], [V19]; plan, A Prior Orchestration Proposal, and Guidance From the `trading` Repository |
| 7. When in doubt, do not spawn; keep spawn counts low | tbd encourages sub-agents for the roles its shortcuts define once the grant exists; outside those roles the restraint rule applies | User decision: tbd encourages sub-agents once authorized (`delegate-to-subagents`, When to Delegate) | [V21]; plan Requirements (sub-agent authorization) |
| 8. Specialize sub-agents with a detailed `description`, preload skills, and enable memory | The generated `tbd-*` definitions set only a model and a reasoning level; the brief names the shortcut to run | Provider neutrality: the same brief works on Codex and elsewhere; setup regenerates the definitions on upgrade; a reviewer that remembers earlier sessions is less independent. Revisit if the tier agents gain project-specific bodies (`agent-model-tiers`, Setting a Tier’s Model and Reasoning Level) | [V1], [V3]; plan Tier Agent Definitions |

## Key Insights

- **`CLAUDE_CODE_SUBAGENT_MODEL` is a fallback, not an override** (since v2.1.251); a
  per-call `model` or a definition’s `model` outranks it, and only
  `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` overrides everything [V1]. Settings written when
  the variable overrode everything, like this repository’s pin to `claude-opus-4-6`, now
  do something different.

- **Forks defeat tiering on both platforms.** A forked sub-agent keeps the parent’s
  model and tools (Claude Code), and Codex tells its model that a full-history fork
  keeps the parent’s model and effort (its runtime now applies overrides anyway), so
  tier-specific work needs a fresh, named sub-agent [V1], [V16].

- **Effort control differs.** Codex sets effort per spawn; Claude Code needs a
  predefined agent definition for any effort other than the session’s [V1], [V16].

- **Pass the user’s exact authorization into briefs.** A sub-agent’s permission checks
  cannot see approval the coordinator received [V21].

- **Check what a sub-agent actually changed,** not only its summary [V21]. A sub-agent
  also cannot reliably report its own model, and availability or content-based fallback
  can move it to a weaker model silently [V23], so record what was requested.

- **A Claude Code sub-agent runs under its definition body, not the Claude Code system
  prompt,** so the body is its whole behavioral prompt; a Codex child keeps the full
  Codex prompt and `AGENTS.md`, with a role’s `developer_instructions` replacing the
  parent’s [V1], [V41]. Only the brief and the shortcut it names are portable.

- **Starting fresh is cheap under caching.** A sub-agent’s prefix (tools, body,
  `CLAUDE.md`) is written once and re-read at a tenth of the input price per turn; a
  fork re-reads the coordinator’s whole context every turn instead.
  Sub-agents get the 5-minute TTL by default even on a subscription [V39], [V40].

- **Delegating trivial commands is discouraged** on both platforms [V20], [V21], which
  is in tension with giving routine administrative steps to a separate fast-tier
  sub-agent.

- **Authorization must be explicit to work portably.** Codex will not spawn without an
  explicit request or instruction (except at the `ultra` level, which turns on proactive
  delegation), so a project-level grant in AGENTS.md is also what makes delegation work
  on Codex [V13], [V16].

- **Vendor defaults start lower than tbd’s tiers.** Both vendors start at `high` or a
  measured baseline and raise effort for demanding work [V6], [V14]. tbd’s tiers
  deliberately run delegated review and fixing at the top two levels.

- **Filter findings after the review, not in the reviewer’s prompt,** because severity
  filters make at least Opus 5 under-report [V7].

- **Independent review is recommended; self-verification instructions are not** [V2],
  [V7], [V8].

- **Delegation multiplies cost** by roughly 3 to 15 times, so one agent is often right
  for small or tightly sequential work [V10], [V11].

- **Self-managed compaction beats auto-compaction.** A curated handoff (tbd
  agent-handoff, an outer `claude -p` loop, or a bead-managed loop) preserves failed
  approaches and decisions that repeated summarization loses; memory belongs in the
  filesystem, not the context window.

- **Explore no longer runs on a small model.** Since v2.1.198 it inherits the main
  model, so the February 2026 workarounds for Haiku exploration are obsolete [V1].

## Recommendations

**For most workflows: native sub-agents with explicit models** *(updated 2026-09-16)*:

1. Name the model on every spawn, or in the definition, and add `effort` to the
   definition when the reasoning level matters; treat `CLAUDE_CODE_SUBAGENT_MODEL` as a
   fallback unless `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` is set deliberately.
2. Create custom sub-agents in `.claude/agents/` for project-specific specializations
   (for tbd, the tier agents the plan proposes).
3. Name sub-agents you expect to continue, and resume them with `SendMessage` rather
   than starting fresh.
4. Preload skills for domain knowledge, and keep briefs self-contained.
5. Verify what sub-agents report against GitHub, git, CI, and beads.

**For complex multi-phase projects: the outer loop.** When custom compaction cycles,
arbitrary nesting, per-phase model selection, explicit handoff documents, or per-phase
budget limits are needed, the `claude -p` outer loop gives maximum control at the cost
of complexity and latency.

**For collaborative multi-agent work: agent teams.** When workers need to communicate
with each other rather than only report to a parent, agent teams provide native
coordination, but they are experimental and cost more tokens.

## Next Steps

- [x] Re-read the OpenAI and Codex sources [V13] through [V18] directly and update their
  verification marks (plan bead `tbd-6e2u`; done 2026-09-17).
- [x] Confirm whether Codex sub-agents share the working copy in each tool version (they
  do; confirmed 2026-09-17 from the source).
- [x] Reconcile the written shortcuts and guidelines with the vendor guidance, record
  the classification and the deviations, and consolidate the general delegation advice
  into `delegate-to-subagents` (bead `tbd-ycxf`; done 2026-09-17; see Classification of
  Vendor Recommendations and Deviations From Vendor Guidance).
- [x] Re-read the OpenAI prompt caching documentation and confirm the retention,
  discount, `prompt_cache_key`, and reasoning-effort figures marked as not re-verified
  in Caching From First Principles (the Codex and the OpenAI API paragraph).
  Done 2026-09-18: GPT-5.6+ bills 1.25× writes and 0.1× reads with a 30-minute TTL and
  needs an explicit breakpoint after stable instructions when the task suffix changes,
  because implicit mode writes only at the latest eligible message ([V42], “A shared
  prefix is not always a cached prefix”); earlier models keep automatic caching with no
  write premium and no stated token minimum.
  `client.rs` was re-read the same day and sets no `prompt_cache_options`, so Codex is
  in implicit mode. Tracked as `tbd-2f9j`.
- [ ] Track openai/codex#20077: the handler applies overrides on full-history forks, but
  the V2 instructions still say it does not; re-check when the instructions change.
- [ ] Re-check model names and reasoning levels whenever a provider releases or retires
  a model, and update the dated suggestions here and in `agent-model-tiers`.
- [ ] Revisit this project’s `.claude/settings.json`: it still pins
  `CLAUDE_CODE_SUBAGENT_MODEL` to `claude-opus-4-6` (added 2026-02-13), which since
  v2.1.251 applies only to spawns that name no model and then runs them on an older
  Opus. Either drop it, switch it to an alias, or decide deliberately whether the force
  flag is wanted (it would block the per-spawn models the tbd plan relies on).
- [x] Add `CLAUDE_CODE_SUBAGENT_MODEL` to this project’s `.claude/settings.json` (done
  2026-02-13; see the item above).
- [ ] Ship the tier agent definitions and the `delegate-to-subagents` and
  `review-and-merge-prs` shortcuts from the plan, then record what the Phase 3
  validation runs show about requested versus actual models.
- [ ] Prototype the Ralph Loop script for this project (using tbd handoff).
- [ ] Test `PreCompact` and `SessionStart(compact)` hooks for context backup.
- [ ] Evaluate the token cost of running all sub-agents on the strongest model.
- [ ] Create project-specific custom sub-agents for common tasks.
- [ ] Configure a `Stop` hook to force a handoff before a session ends.
- [ ] Experiment with agent teams for collaborative debugging workflows.
- [ ] Re-verify the compaction details marked as not re-verified (trigger figures, issue
  #15174, third-party handoff tools).

## Methodology

The Claude Code material was researched in February 2026 from the official documentation
and community sources, and re-verified on 2026-09-16 against the live sub-agents, model
configuration, agent teams, run agents in parallel, environment variables, CLI
reference, hooks, and cloud pages; passages that could not be re-verified carry dated
notes.

The cross-vendor material was researched on 2026-09-16 in separate passes: a Claude Code
documentation pass, a Codex documentation and source pass, and a strong-tier (Fable)
pass over 33 Anthropic and OpenAI sources that also checked the plan against them.
The coordinator re-read the sources marked ✓ and corrected two claims from the passes:
background sub-agents keep MCP tools, and forks are available by default rather than
used for every spawn.
Unmarked sources are as reported by the passes.

The two documents were consolidated on 2026-09-16. Where they overlapped, the more
specific wording was kept; no factual conflicts were found.
Four points were re-checked against the sub-agents page during consolidation (the
`claude` built-in, definition reload timing, the Agent tool’s `name` and
`run_in_background` parameters, and the report scan) and against the Piebald
reconstruction (the `name` and `run_in_background` parameters), and all matched.

The Codex and OpenAI sources [V13] through [V18] were re-read on 2026-09-17 (bead
`tbd-6e2u`): the Codex documentation pages as Markdown, the OpenAI API pages, and the
openai/codex source at commit `b0659c53` (main, 2026-09-17), compared where it mattered
with the last stable release, rust-v0.154.0 (2026-09-09), and with the earlier pin
`787823cf`. Three claims were corrected: Codex’s runtime applies `model` and
`reasoning_effort` overrides on full-history forks (only the instructions say
otherwise); both tool versions share the working directory; and the V2 concurrency and
depth defaults differ from V1. Two were made more precise: the Sol and Astra effort
sets, and the custom agent file fields.

## References

Verification marks: ✓ means re-read directly on 2026-09-16, by the coordinator (the
cross-vendor sources) or by the Claude Code re-verification pass (the documentation
pages listed in Methodology), or on 2026-09-17 by the Codex re-verification pass
(`tbd-6e2u`); unmarked means reported by a research pass or by the February 2026
research and not re-read since.
Numbers [V1] through [V22] are shared with the plan and are stable; [V23] onward were
added at consolidation for sources that only the Claude Code research cited.

- **[V1] ✓** Claude Code,
  [Create custom subagents](https://code.claude.com/docs/en/sub-agents) (notes through
  v2.1.271): definition fields including `effort`, model precedence, forks, tool
  allowlists, caps, report scanning, built-in sub-agents, resuming, background behavior.

- **[V2]** Claude Code,
  [Best practices](https://code.claude.com/docs/en/best-practices): fresh-context
  reviewers, writer and reviewer pattern, evidence over assertions.

- **[V3] ✓** Claude Code,
  [Run agents in parallel](https://code.claude.com/docs/en/agents) and
  [Orchestrate agent teams](https://code.claude.com/docs/en/agent-teams): when to use
  sub-agents, the four parallel surfaces, teams of 3 to 5, file partitioning, teammate
  models and limits.

- **[V4]** Claude Code, [Dynamic workflows](https://code.claude.com/docs/en/workflows)
  and [Manage costs](https://code.claude.com/docs/en/costs): smaller models for stages
  that do not need the strongest; multi-agent token cost.

- **[V5]** Agent SDK, [Subagents](https://code.claude.com/docs/en/agent-sdk/subagents):
  only the prompt string crosses to a fresh sub-agent; depth, concurrency, and spend
  caps; the Opus 5 delegation line in the `claude_code` preset.

- **[V6] ✓** Claude Platform,
  [Effort](https://platform.claude.com/docs/en/build-with-claude/effort): effort levels
  and per-model recommendations.

- **[V7] ✓** Claude Platform,
  [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5):
  delegation control, review calibration, over-verification.

- **[V8]** Claude Platform,
  [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)
  and
  [Fable 5.1](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1):
  parallel sub-agents, fresh-context verifiers, progress-claim audits.

- **[V9]** Claude Platform,
  [System prompts release notes](https://platform.claude.com/docs/en/release-notes/system-prompts/overview):
  scope of published system prompts.

- **[V10]** Anthropic Engineering,
  [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
  (2025-06-13): orchestrator-worker pattern (Opus lead, Sonnet workers), brief contents,
  effort scaling, token cost.

- **[V11]** Claude blog,
  [When to use multi-agent systems](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)
  (2026-01-23): token cost, verification as the cheapest delegation.

- **[V12]** Anthropic Engineering,
  [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
  (2025-09-29): condensed sub-agent returns.

- **[V13] ✓ (2026-09-17)** Codex,
  [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) and
  [Config reference](https://learn.chatgpt.com/docs/config-file/config-reference), read
  as the Markdown served at the page URL plus `.md`: explicit and proactive modes,
  custom agent files and precedence, `[agents]` settings, effort values, sandbox and
  approval inheritance.

- **[V14] ✓ (2026-09-17)** Codex,
  [Best practices](https://learn.chatgpt.com/guides/best-practices); OpenAI,
  [Reasoning](https://developers.openai.com/api/docs/guides/reasoning) and
  [Prompt guidance for GPT-5.6](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6):
  effort by task, a measured baseline before raising effort, `max` not recommended
  globally, sub-agents for bounded offloaded work.

- **[V15] ✓ (2026-09-17)** OpenAI,
  [Multi-agent (Responses API)](https://developers.openai.com/api/docs/guides/responses-multi-agent)
  and
  [Agents SDK multi-agent](https://openai.github.io/openai-agents-python/multi_agent/):
  when to split work, `max_concurrent_subagents` (default 3), agents-as-tools and
  handoffs.

- **[V16] ✓ (2026-09-17)**
  [openai/codex at `b0659c53`](https://github.com/openai/codex/tree/b0659c53865dd48b0cd69c454368cea3980017cc)
  (main, 2026-09-17; the spawn handlers at tag `rust-v0.154.0`, 2026-09-09, apply the
  same rules): `codex-rs/core/src/tools/handlers/multi_agents_spec.rs` (tool parameters
  and descriptions), `multi_agents/spawn.rs` and `multi_agents_v2/spawn.rs` (handlers),
  `codex-rs/core/src/agent/child_config.rs` (override and fork rules, `cwd`
  inheritance), `agent/role.rs` (custom agent overrides), `agent/registry.rs` (depth),
  `codex-rs/core/src/session/multi_agents.rs` (explicit and proactive modes),
  `codex-rs/core/src/config/mod.rs` (`[agents]` and `multi_agent_v2` defaults),
  `codex-rs/features/src/lib.rs` (feature flags),
  `codex-rs/prompts/src/multi_agent_instructions.rs` (the fork hint and shared-directory
  text), `codex-rs/protocol/src/openai_models.rs` (the effort enum), and the tests in
  `multi_agents_tests.rs`; issue [#20077](https://github.com/openai/codex/issues/20077)
  (open, last updated 2026-09-01).

- **[V17] ✓ (2026-09-17)** Codex, [Models](https://learn.chatgpt.com/docs/models) and
  OpenAI, [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol):
  model lineup, ranking, surfaces, effort levels, `max` and `ultra`, GPT-5.5 retirement
  date.

- **[V18] ✓ (2026-09-17)** OpenAI,
  [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) and
  [Latest model guidance](https://developers.openai.com/api/docs/guides/latest-model):
  capabilities, effort levels (no `none`), and the delegation prompt, which matches the
  source’s proactive-mode text word for word.

- **[V19]** Claude Platform,
  [Build an orchestration mode](https://platform.claude.com/docs/en/build-with-claude/mid-conversation-effort-example):
  scout, then fan out to about ten subtasks for a module-sized review.

- **[V20] ✓**
  [openai/codex at `787823cf957709b314276646024ec54e1761c089`](https://github.com/openai/codex/tree/787823cf957709b314276646024ec54e1761c089):
  [`multi_agents_spec.rs`](https://github.com/openai/codex/blob/787823cf957709b314276646024ec54e1761c089/codex-rs/core/src/tools/handlers/multi_agents_spec.rs),
  [`multi_agent_instructions.rs`](https://github.com/openai/codex/blob/787823cf957709b314276646024ec54e1761c089/codex-rs/prompts/src/multi_agent_instructions.rs),
  [`model_messages/multi_agent.rs`](https://github.com/openai/codex/blob/787823cf957709b314276646024ec54e1761c089/codex-rs/prompts/src/model_messages/multi_agent.rs),
  [`collab/experimental_prompt.md`](https://github.com/openai/codex/blob/787823cf957709b314276646024ec54e1761c089/codex-rs/core/templates/collab/experimental_prompt.md),
  [`agents/orchestrator.md`](https://github.com/openai/codex/blob/787823cf957709b314276646024ec54e1761c089/codex-rs/core/templates/agents/orchestrator.md),
  and
  [`agent/role.rs`](https://github.com/openai/codex/blob/787823cf957709b314276646024ec54e1761c089/codex-rs/core/src/agent/role.rs)
  (source code; read directly on 2026-09-16, and re-read on 2026-09-17 at `b0659c53`,
  where the prompt and template files were identical and `multi_agents_spec.rs` had
  gained only a description-override parameter).

- **[V21] ✓**
  [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts)
  at commit `6532300` (tracking Claude Code v2.1.274): a third-party reconstruction of
  Claude Code CLI prompt fragments, not an Anthropic publication; fragments cited
  include `tool-description-agent-usage-notes.md`,
  `system-prompt-subagent-delegation-restraint.md`,
  `system-prompt-subagent-delegation-cost-guidance.md`,
  `system-prompt-writing-subagent-prompts.md`,
  `tool-description-agent-explicit-spawn-restriction.md`, and
  `system-prompt-coordinator-mode-orchestration.md`.

- **[V22]** A local capture of one Claude Code desktop-app session’s resolved system
  prompt and tool definitions (2026-09-16), kept outside the repository because it
  contains user-specific details; reviewed directly.

- **[V23] ✓** Claude Code,
  [Model configuration](https://code.claude.com/docs/en/model-config): model aliases,
  `ANTHROPIC_DEFAULT_*_MODEL` variables, `CLAUDE_CODE_SUBAGENT_MODEL` as the sub-agent
  default, effort levels, `opusplan`, default model by account type, fallback.

- **[V24]** Claude Code, [Settings](https://code.claude.com/docs/en/settings): settings
  scope and precedence, the `env` field, `availableModels`.

- **[V25] ✓** Claude Code,
  [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
  and [Cloud environments](https://code.claude.com/docs/en/cloud-environments): cloud
  sessions, environment variables, `--cloud`, teleport, what is restored on reopen.

- **[V26] ✓** Claude Code,
  [Environment variables](https://code.claude.com/docs/en/env-vars): sub-agent depth and
  concurrency caps, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`; `CLAUDE_ENV_FILE` no longer
  listed.

- **[V27] ✓** Claude Code,
  [CLI reference](https://code.claude.com/docs/en/cli-reference): `--model`, `--effort`,
  `--fallback-model`, `--agents`, `--append-system-prompt` and the sub-agent variants,
  `--max-turns`, `--max-budget-usd`, `--disallowedTools`.

- **[V28]** Claude Code,
  [Run Claude Code programmatically](https://code.claude.com/docs/en/headless):
  `claude -p`, output formats, session continuity flags.

- **[V29] ✓** Claude Code, [Hooks reference](https://code.claude.com/docs/en/hooks):
  `SubagentStart`, `SubagentStop`, `PreCompact`, `PostCompact`, `SessionStart`, `Stop`,
  `prompt`-type hooks.

- **[V30]** Claude Code,
  [Tools reference](https://code.claude.com/docs/en/tools-reference): the Agent tool and
  the availability of the task-tracking tools (`TaskCreate` and friends); checked on
  2026-09-16 only for a per-invocation turn cap, which it does not list.

- **[V31]** Claude Code,
  [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees) and
  [Common workflows](https://code.claude.com/docs/en/common-workflows):
  `isolation: worktree` enforcement and base branch, parallel sessions with git
  worktrees.

- **[V32]** Claude Code,
  [Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging):
  listing and messaging the user’s other sessions.

- **[V33]** Claude Agent SDK:
  [overview](https://platform.claude.com/docs/en/agent-sdk/overview),
  [streaming output](https://platform.claude.com/docs/en/agent-sdk/streaming-output),
  [structured outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs),
  the [migration guide](https://code.claude.com/docs/en/agent-sdk/migration-guide) from
  the Claude Code SDK packages, and the
  [`anthropics/claude-agent-sdk-python`](https://github.com/anthropics/claude-agent-sdk-python)
  repository.

- **[V34]** Claude Code,
  [Manage Claude’s memory](https://code.claude.com/docs/en/memory) and
  [Slash commands](https://code.claude.com/docs/en/slash-commands): context management,
  compaction, `/compact`, `/context`, `/model`, `/status`.

- **[V35]** [The Ralph Loop](https://awesomeclaude.ai/ralph-wiggum): the foundational
  outer-loop pattern for autonomous multi-iteration work (community source; not
  re-verified 2026-09-16).

- **[V36]** Third-party handoff tools (community sources; not re-verified 2026-09-16):
  [Smart Handoff for Claude Code](https://blog.skinnyandbald.com/never-lose-your-flow-smart-handoff-for-claude-code/)
  (custom compact message plus a WORKING.md pattern),
  [Continuous-Claude-v3](https://github.com/parcadei/Continuous-Claude-v3) (ledger-based
  persistence with handoffs),
  [claude-handoff plugin](https://github.com/willseltzer/claude-handoff) (documenting
  failed approaches),
  [claude-code-handoff](https://github.com/nlashinsky/claude-code-handoff) (JSON-based
  machine-readable handoff format), and
  [Context backups: beat auto-compaction](https://claudefa.st/blog/tools/hooks/context-recovery-hook)
  (a `PreCompact` hook for transcript backup).

- **[V37]** Claude Code issues (not re-verified 2026-09-16):
  [#15174](https://github.com/anthropics/claude-code/issues/15174), the `SessionStart`
  hook with the `compact` matcher executes but its stdout is not injected after
  compaction; [#21776](https://github.com/anthropics/claude-code/issues/21776), a
  self-checkpoint feature request closed as a duplicate.

- **[V38] ✓ (2026-09-17)** openai/codex pull request
  [#37252](https://github.com/openai/codex/pull/37252), “Allow agent roles on
  full-history forks”, merged 2026-08-06 and first released in rust-v0.148.0
  (2026-08-18): removed the V2 rejection of `agent_type` on full-history forks.

- **[V39] ✓ (2026-09-17)** Claude Code,
  [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching):
  request layering, actions that invalidate or keep the cache, the two TTL buckets and
  `subagentPromptCacheTtl`, cache scope, the “Subagents and the cache” section, and how
  to read cache usage.

- **[V40] ✓ (2026-09-17)** Claude Platform,
  [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching):
  pricing multipliers, minimum cacheable length per model, prefix order and invalidation
  (including thinking and effort changes), TTL and refresh, concurrency, and per-model
  and per-workspace isolation.

- **[V41] ✓ (2026-09-17)** openai/codex at `main` on 2026-09-17:
  `codex-rs/core/src/agent/child_config.rs` (a fresh child receives the session’s
  current base instructions; developer instructions copy to the child only on a V2
  full-history fork), `codex-rs/core/src/agent/role.rs` (a role’s
  `developer_instructions` replace the config value; the built-in roles and their
  embedded config files), and `codex-rs/core/assets/agent/builtins/awaiter.toml` (the
  built-in awaiter at `low` reasoning effort).

- **[V42] ✓ (2026-09-18)** OpenAI,
  [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching):
  GPT-5.6+ vs earlier-model regimes; 1.25× cache writes and 0.1× cache reads on
  GPT-5.6+; 1,024-token minimum; `prompt_cache_options.mode` / `ttl: "30m"`;
  `prompt_cache_breakpoint`; `prompt_cache_key` as accounting on GPT-5.6+ and as routing
  on earlier models; `prompt_cache_retention` (`in_memory`, `24h`) on earlier models;
  `reasoning.effort` invalidation and `configuration_update` on supported GPT-6 models;
  `cached_tokens` / `cache_write_tokens`. Replaces the 2026-09-17 memory-only note.

- **[V43] ✓ (2026-09-17)** Claude Platform,
  [Pricing](https://platform.claude.com/docs/en/about-claude/pricing): per-model base,
  cache write, cache read, and output prices; the Fable 5.1 and Mythos 5.1 0.025x read
  rate; the tokenizer note for Opus 4.7 and later; break-even for the two cache
  durations.

- **[V44] ✓ (2026-09-17)** openai/codex at `main` on 2026-09-17,
  `codex-rs/core/src/client.rs`: `prompt_cache_key` (session ID, or
  `<source>:<parent_thread_id>` for an internally spawned thread), `store: false`,
  `reasoning.encrypted_content` included, full history except over WebSocket with
  `previous_response_id`, no `prompt_cache_retention`.

- **[V45] ✓ (2026-09-17)** Anthropic, the bundled `claude-api` reference skill (Claude
  Code v2.1.274, `shared/prompt-caching.md` and the model migration notes): invalidation
  hierarchy and the three cache-preserving escape hatches (tools and system prompt as
  mid-conversation system messages; per-message effort behind
  `mid-conversation-output-config-2026-07-01` on Fable 5.1, Mythos 5.1, and Opus 5);
  preserved thinking and the history-editing check on Fable 5.1. The public prompt
  caching page [V40] is the primary cite for the `max_tokens: 0` keep-alive and the
  per-model minimum cacheable prefix applying on every platform.

- **[V46] ✓ (2026-09-18)** OpenAI,
  [Pricing](https://developers.openai.com/api/docs/pricing): standard short-context list
  prices for `gpt-6-astra` and `gpt-5.6-sol` (input, cached input, cache writes,
  output). Cache-write is 1.25× input and cached input is 0.1× input on both.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
