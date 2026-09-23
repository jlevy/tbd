---
title: Agent Model Tiers
description: Provider-neutral model tiers for delegated agent work. Defines the strong, moderate, and fast tiers by model rank and reasoning level within the agent's own provider, the work each tier does, rules for choosing a model and level on any platform, how the generated tier agent definitions set a reasoning level, and dated model suggestions. Load when delegating to sub-agents or choosing a model and reasoning level for a task.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Agent Model Tiers

A delegated task needs a model and a reasoning level, and the right choice depends on
the work, not on a vendor.
tbd does not assume any provider.
Each tier is defined by model rank and reasoning level within the agent’s own provider,
so the tiers apply the same way to providers not named in this guideline.

**Related**:

- `delegate-to-subagents` (authorization, spawn mechanisms, and briefs for delegated
  work)
- `pr-review-workflows` (the roles that use each tier, and the review header that
  records it)
- `agent-run-operations-rules` (delegated-agent hygiene on long runs)

## The Tiers

The next-tier model is the model ranked immediately below the strongest one from the
same provider.

| Tier | Model | Reasoning level | Work |
| --- | --- | --- | --- |
| strong | The strongest model available from the provider | Highest or second-highest | Senior engineering, security, performance, and correctness reviews; additional review rounds; design decisions; escalated findings |
| moderate | The next-tier model from the same provider | Highest or second-highest | Addressing findings: code and test edits, confirming fixes, resolving conflicts |
| fast | The next-tier model | Middle levels, below the moderate setting (for example `medium` or `high`) | Administrative work: collecting PR and CI state, waiting on CI, bead bookkeeping, posting prepared replies, conflict-free rebases |

The coordinator is the user’s own session, and it is not assigned a tier.
What it does inline and what it hands to a fast-tier sub-agent is in When to Delegate in
`delegate-to-subagents`.

These settings are deliberately higher than vendor defaults, which start at `high` and
suggest smaller models or low reasoning levels for simple stages.
A delegated agent works only from its brief, so the fast tier stays on the next-tier
model rather than a smaller one.

## Selection Rules

- Rank the models your own platform offers from its provider, and choose the best
  available match for each tier.
- Within a tier’s range, use the higher reasoning level for harder or riskier work.
- If the platform offers one model, strong and moderate use its top two reasoning levels
  and fast uses its middle levels.
- If the platform has no reasoning control, vary only the model.
- If the strongest model is unavailable (for example on a restricted plan), use the best
  available, record the substitution, and tell the user when strong-tier work ran on a
  weaker model.
- Record the tier, model, and reasoning level requested for every delegated task.
  A sub-agent cannot reliably report its own configuration, so the record comes from the
  spawn request, as in a review header’s
  `Reviewer: strong tier, requested <model> at <level>`.
- Without sub-agents, one session does the work of every tier; record that session’s
  actual model and reasoning level.

## Setting a Tier’s Model and Reasoning Level

Start tier work in a fresh, named sub-agent, not a fork.
A fork inherits the parent’s model and tools and ignores or rejects tier settings.

- **Claude Code** sets a sub-agent’s model per spawn but its reasoning level only
  through an agent definition or the session.
  For this, `tbd setup` generates four agent definitions in `.claude/agents/`:
  `tbd-strong-max` (`max`), `tbd-strong` (`xhigh`), `tbd-moderate` (`xhigh`), and
  `tbd-fast` (`medium`). Use `tbd-strong-max` for the harder or riskier strong-tier
  work. A sub-agent spawned without one inherits the session’s level; record that level.
- **Codex** sets both the model and the reasoning level per spawn, so the matching
  definitions `tbd setup` generates in `.codex/agents/` are a convenience, not a
  requirement.
- **Other platforms** get no generated files.
  Apply the tier definitions directly with the platform’s own controls, and record which
  settings it could not control.

The generated definitions take their models and levels from the suggestions below, and
setup refreshes them on upgrade, so updating tbd also updates them.
Users can override them.
They are deliberately small: each sets a model and a level, and the brief names the
shortcut to run, so they preload no skills and keep no memory, and the same brief works
on every platform.

## Suggested Models as of 2026-09-16

> **Suggestions as of 2026-09-16, not requirements.** Model names and reasoning levels
> change quickly and must be kept current: update these examples when a provider’s
> lineup changes, and prefer a current equivalent over a retired name.
> Other providers’ models map to the tiers the same way.

| Tier | Anthropic example | OpenAI example |
| --- | --- | --- |
| strong | Fable (`fable`) at `max` or `xhigh` | GPT-6 Astra (`gpt-6-astra`) at `max` or `xhigh` |
| moderate | Opus (`opus`) at `max` or `xhigh` | GPT-5.6 Sol (`gpt-5.6-sol`) at `max` or `xhigh` |
| fast | Opus (`opus`) at `high` or `medium` | GPT-5.6 Sol (`gpt-5.6-sol`) at `high` or `medium` |

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
