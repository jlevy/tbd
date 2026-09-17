# Research: Sub-Agent Guidance for Anthropic and OpenAI Models

**Date:** 2026-09-16 (last updated 2026-09-16)

**Author:** Joshua Levy, with Claude (Opus 5) and research sub-agents

**Status:** In Progress; maintained as backing research for the plan below

**Related:**

- [PR review lifecycle, policy grants, and sub-agent delegation plan](../../specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md)
- [Claude Code sub-agents research](research-claude-code-sub-agents.md), which covers
  Claude Code sub-agent architecture and orchestration patterns in depth

## Overview

tbd’s plan for PR review workflows and sub-agent delegation needs current facts about
how coding agents delegate to sub-agents, and what the model vendors recommend.
This brief collects that research for the two platforms tbd generates setup surfaces
for, Claude Code (Anthropic) and Codex (OpenAI), so the plan and the shortcuts built
from it can cite one maintained source.

**Maintenance.** Platform mechanics, model names, and reasoning levels change quickly.
Every fact here is dated.
Re-verify a source before relying on it, update its verification mark, and update the
dated model suggestions in the `agent-model-tiers` guideline when a provider’s lineup
changes.

## Questions to Answer

1. How does a parent agent choose the model and reasoning effort of a sub-agent on
   Claude Code and on Codex?
2. What do Anthropic and OpenAI recommend about when to delegate, how many sub-agents to
   run, what to put in a brief, and how to verify results?
3. What do the platforms’ system prompts and tool descriptions tell models about
   delegation?
4. Which current models and reasoning levels correspond to tbd’s strong, moderate, and
   fast tiers?
5. Where does vendor guidance support or differ from tbd’s plan?

## Scope

**Included:** Claude Code, the Claude Agent SDK, Anthropic’s effort and prompting docs
and engineering posts; Codex (CLI, app, IDE extension) sub-agents and configuration, the
open-source Codex prompts and tool definitions, OpenAI’s reasoning and multi-agent API
docs, and the OpenAI Agents SDK.

**Excluded:** other providers and agent platforms (tbd’s tiers apply to them by
principle); Claude Code agent teams beyond their limits; cross-provider delegation;
Claude Code sub-agent internals covered by the Claude Code sub-agents research.

## Findings

### Platform Mechanics (as of 2026-09-16)

The Claude Code rows were checked against the documentation.
The Codex rows come from a research pass over OpenAI’s documentation and the Codex
source and must be re-verified before they are written into shortcuts.

| Capability | Claude Code | Codex |
| --- | --- | --- |
| Spawn mechanism | Agent tool (`subagent_type`, `model`, optional `isolation: worktree`) [V1] | `spawn_agent` tool; V1 takes `message`, `agent_type`, `fork_context`, `model`, `reasoning_effort`; V2 adds a required `task_name` and replaces `fork_context` with `fork_turns` (`none`, `all`, or a number) [V16] |
| Forked context | A fork inherits the parent’s history, model, and tools and ignores the definition’s `model` and `tools` [V1] | A full-history fork inherits model and effort and rejects overrides [V16] |
| Model per spawn | Yes; aliases such as `fable` and `opus`, or full IDs [V1] | Yes [V16] |
| Effort per spawn | **No.** Only from the agent definition’s `effort` field or the session’s effort level [V1] | Yes, except that a spawn forking full history rejects model and effort overrides [V16] |
| Effort levels | `low`, `medium`, `high`, `xhigh`, `max`, model-dependent [V6] | Docs disagree: the subagents page lists `low`, `medium`, `high`, `xhigh`, `max`, `ultra`; the config reference lists `minimal` through `xhigh` [V13] |
| Predefined agents | `.claude/agents/*.md` (project) or `~/.claude/agents/`; plugins can ship them, skills cannot [V1] | `.codex/agents/*.toml` (project) or `~/.codex/agents/`; `name`, `description`, `developer_instructions`, optional `model`, `model_reasoning_effort`, `sandbox_mode` [V13] |
| Definition reload | Edits load within seconds; the first file in a new `agents/` directory needs a restart [V1] | Not established |
| Working copy | Shared by default; `isolation: worktree` creates a worktree from the default branch, removed automatically if unchanged [V1] | Source text describes agents sharing one working directory, while the V1 spawn description mentions a forked workspace; confirm per version [V16] |
| Nesting and concurrency | Default depth 3 and 20 concurrent sub-agents, both configurable [V1] | V1 defaults: depth 1, 6 threads (from source) [V16] |
| Model overrides from the environment | `CLAUDE_CODE_SUBAGENT_MODEL` applies when no model is named; `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` overrides named models too [V1] | `[agents]` defaults in config; custom agent files override spawn values [V13] |
| Background sub-agents | A reduced set of built-in tools; MCP tools are kept [V1] | Not applicable |
| Report handling | The final report is scanned; instruction-shaped text is flagged and neutralized, never removed [V1] | Not established |
| Permissions | Background sub-agents inherit the permission mode [V1] | Sub-agents inherit the sandbox and approval policy; a new approval in a non-interactive run fails back to the parent [V13] |

### Current Models and Reasoning Levels

**Anthropic.**

- The `fable` alias is the most capable model and ranks above `opus` [V1], [V6].
- Effort levels are `low`, `medium`, `high`, `xhigh`, and `max`; not every model that
  supports `max` supports `xhigh` [V6].
- `high` is the default and the recommended starting point for Fable 5.1 and Opus 5.
  Step up to `xhigh` or `max` for the most capability-sensitive agentic and coding work,
  and down to `medium` or `low` for routine work once evaluations show quality holds
  [V6].
- The effort table lists `low` for simple tasks “such as subagents” [V6].
- Opus 5 review accuracy holds at lower effort [V7].

**OpenAI** (as reported by the research pass; not yet re-read directly):

- GPT-6 Astra (`gpt-6-astra`) is OpenAI’s most capable model, for the hardest end-to-end
  work; it runs in the Codex CLI, app, and IDE extension but not Codex cloud, and
  supports `low` through `max` [V17], [V18].
- The GPT-5.6 family ranks below it: Sol (`gpt-5.6-sol`, the most capable GPT-5.6
  model), Terra (balanced), and Luna (fast and inexpensive).
  In the API, `gpt-5.6` routes to Sol, and Sol supports `none` through `max` [V17].
- In Codex, `model_reasoning_effort` sets the level; the app’s “Extra High” is `xhigh`,
  `max` spends more time on one task, and `ultra` also uses sub-agents in parallel
  [V13], [V17].
- GPT-5.5 retires from Codex for ChatGPT sign-in on 2026-10-14, replaced by
  `gpt-5.6-sol` [V17].

**Mapping to tbd’s tiers** (suggestions as of 2026-09-16):

| Tier | Definition | Anthropic example | OpenAI example |
| --- | --- | --- | --- |
| strong | Strongest model from the provider, highest or second-highest level | Fable at `max` or `xhigh` | GPT-6 Astra at `max` or `xhigh` |
| moderate | Next-tier model, highest or second-highest level | Opus at `max` or `xhigh` | GPT-5.6 Sol at `max` or `xhigh` |
| fast | Next-tier model, middle levels | Opus at `high` or `medium` | GPT-5.6 Sol at `high` or `medium` |

### Anthropic Guidance

- **When to delegate:** use sub-agents for self-contained work whose verbose output
  should stay out of the main context, or to enforce tool restrictions; stay in one
  conversation when phases share context or need back-and-forth [V1], [V3].
- **Delegation appetite differs by model:** Opus 5 delegates readily and should be told
  which scenarios warrant delegation, with deterministic caps for cost-sensitive work;
  Fable 5 and 5.1 guidance encourages parallel sub-agents [V7], [V8].
- **How many:** Claude Code allows depth 3 and 20 concurrent sub-agents by default [V1];
  agent teams work best at 3 to 5 teammates [V3]; the orchestration-mode example scouts
  first, then fans out to about ten subtasks for a module-sized review [V19].
- **Cost:** multi-agent work uses roughly 3 to 10 times the tokens of a single agent
  [V11], and about 15 times chat in Anthropic’s research system [V10]; use smaller
  models for stages that do not need the strongest [V4].
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

### OpenAI Guidance

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
- **Forking and overrides:** a full-history fork inherits the parent’s model and effort
  and rejects overrides, so set `fork_turns` to `none` or a number when choosing a tier
  [V16]; see openai/codex#20077.

### What the System Prompts Say

Three sources were compared on 2026-09-16:

- **Claude Code, as reconstructed by a third party.** Anthropic does not publish Claude
  Code’s system prompt [V9]. Piebald-AI maintains a reconstruction of the CLI’s prompts
  as version-tagged template fragments, tracking v2.1.274 at the compared commit [V21].
- **Claude Code, as observed.** One Claude Code desktop-app session’s resolved prompt
  and tool definitions were captured locally (not published) and reviewed [V22].
- **Codex, from source.** Codex’s multi-agent prompts and tool descriptions are open
  source; the files below were read at commit `787823cf` [V20].

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
  because full-history forks inherit the parent’s model and effort and reject overrides.
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
  message; an orchestrator template instead tells the coordinator to wait for sub-agents
  and not do the work itself, which differs from the spawn tool’s advice to keep
  working.

**Rules on both platforms:** explicit authorization (always on Codex, on some plans in
Claude Code); fresh context rather than forks when choosing a model; self-contained
briefs; not duplicating delegated work; relaying and checking results; cleaning up
finished agents.

**Rules only one platform states:** quoting the user’s exact approval in a brief (Claude
Code coordinator mode); telling sub-agents they share the workspace and whether they may
spawn (Codex); giving reviewers the code rather than a conclusion (Claude Code).

## Key Insights

- **Pass the user’s exact authorization into briefs.** A sub-agent’s permission checks
  cannot see approval the coordinator received [V21].

- **Check what a sub-agent actually changed,** not only its summary [V21].

- **Delegating trivial commands is discouraged** on both platforms [V20], [V21], which
  is in tension with giving routine administrative steps to a separate fast-tier
  sub-agent.

- **Forks defeat tiering on both platforms.** A forked sub-agent keeps the parent’s
  model and tools (Claude Code) or rejects model and effort overrides (Codex), so
  tier-specific work needs a fresh, named sub-agent [V1], [V16].

- **Effort control differs.** Codex sets effort per spawn; Claude Code needs a
  predefined agent definition for any effort other than the session’s [V1], [V16].

- **Authorization must be explicit to work portably.** Codex will not spawn without an
  explicit request or instruction, so a project-level grant in AGENTS.md is also what
  makes delegation work on Codex [V13], [V16].

- **Vendor defaults start lower than tbd’s tiers.** Both vendors start at `high` or a
  measured baseline and raise effort for demanding work [V6], [V14]. tbd’s tiers
  deliberately run delegated review and fixing at the top two levels.

- **Filter findings after the review, not in the reviewer’s prompt,** because severity
  filters make at least Opus 5 under-report [V7].

- **Independent review is recommended; self-verification instructions are not** [V2],
  [V7], [V8].

- **Delegation multiplies cost** by roughly 3 to 15 times, so one agent is often right
  for small or tightly sequential work [V10], [V11].

## Next Steps

- [ ] Re-read the OpenAI and Codex sources [V13] through [V18] directly and update their
  verification marks (plan bead `tbd-6e2u`).
- [ ] Confirm whether Codex sub-agents share the working copy in each tool version.
- [ ] Track openai/codex#20077 (overrides rejected on full-history forks).
- [ ] Re-check model names and reasoning levels whenever a provider releases or retires
  a model, and update the dated suggestions here and in `agent-model-tiers`.

## Methodology

Research on 2026-09-16 used separate passes: a Claude Code documentation pass, a Codex
documentation and source pass, and a strong-tier (Fable) pass over 33 Anthropic and
OpenAI sources that also checked the plan against them.
The coordinator re-read the sources marked ✓ and corrected two claims from the passes:
background sub-agents keep MCP tools, and forks are available by default rather than
used for every spawn.
Unmarked sources are as reported by the passes.

## References

Verification marks: ✓ means re-read directly on 2026-09-16; unmarked means reported by a
research pass.

- **[V1] ✓** Claude Code,
  [Create custom subagents](https://code.claude.com/docs/en/sub-agents) (notes through
  v2.1.271): definition fields including `effort`, model precedence, forks, tool
  allowlists, caps, report scanning.

- **[V2]** Claude Code,
  [Best practices](https://code.claude.com/docs/en/best-practices): fresh-context
  reviewers, writer and reviewer pattern, evidence over assertions.

- **[V3]** Claude Code, [Run agents in parallel](https://code.claude.com/docs/en/agents)
  and [Orchestrate agent teams](https://code.claude.com/docs/en/agent-teams): when to
  use sub-agents, teams of 3 to 5, file partitioning.

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
  (2025-06-13): brief contents, effort scaling, token cost.

- **[V11]** Claude blog,
  [When to use multi-agent systems](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)
  (2026-01-23): token cost, verification as the cheapest delegation.

- **[V12]** Anthropic Engineering,
  [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
  (2025-09-29): condensed sub-agent returns.

- **[V13]** Codex,
  [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) and
  [Config reference](https://learn.chatgpt.com/docs/config-file/config-reference):
  explicit and proactive modes, custom agent files, `[agents]` settings, effort values.

- **[V14]** Codex, [Best practices](https://learn.chatgpt.com/guides/best-practices);
  OpenAI, [Reasoning](https://developers.openai.com/api/docs/guides/reasoning) and
  [Prompt guidance for GPT-5.6](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6):
  effort by task and measured gains.

- **[V15]** OpenAI,
  [Multi-agent (Responses API)](https://developers.openai.com/api/docs/guides/responses-multi-agent)
  and
  [Agents SDK multi-agent](https://openai.github.io/openai-agents-python/multi_agent/):
  when to split work, concurrency defaults, agents-as-tools and handoffs.

- **[V16] ✓ (spawn description only)** [openai/codex](https://github.com/openai/codex)
  at `787823cf`: `codex-rs/core/src/tools/handlers/multi_agents_spec.rs`,
  `codex-rs/prompts/src/multi_agent_instructions.rs`, `codex-rs/core/src/agent/role.rs`,
  `codex-rs/core/src/config/mod.rs`; issue
  [#20077](https://github.com/openai/codex/issues/20077).

- **[V17]** Codex, [Models](https://learn.chatgpt.com/docs/models) and OpenAI,
  [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol): model
  lineup, ranking, effort levels, GPT-5.5 retirement date.

- **[V18]** OpenAI,
  [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) and
  [Latest model guidance](https://developers.openai.com/api/docs/guides/latest-model):
  capabilities, effort levels, delegation prompt.

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
  (source code; read directly).

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

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
