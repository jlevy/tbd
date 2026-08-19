---
title: Plan Spec
description: Separate who is accountable from who is executing, so an agent can hold a bead without displacing the human who owns it, and project the resulting lifecycle onto a default Linear board that distinguishes planned from ready and paused from never-started
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Actor Axis and Board Projection

**Date:** 2026-08-18

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Draft

**Design discussion:** [#246](https://github.com/jlevy/tbd/issues/246) — the provider
comparison and the measured evidence are argued there and are not re-argued here.

**Sibling:**
[plan-2026-08-18-tracker-state-model-and-linear-mapping.md](./plan-2026-08-18-tracker-state-model-and-linear-mapping.md)
(epic `tbd-og20`, [#244](https://github.com/jlevy/tbd/issues/244)) adds `resolution`,
`hold`, and `started_at`, and replaces position-based Linear state resolution with
name-based. This spec is the second axis of the same model and depends on that resolver;
it does not restate the state design.

## Overview

tbd has one actor field, `assignee: z.string()`. Linear has two — `assignee`
(accountable) and `delegate` (acting) — and its entire agent platform hangs off the
second. The collapse is silent, and in an agent-driven repository it makes the field
unusable in either direction.

This adds `delegate` beside `assignee`, gives the identity table an actor **kind** so
publishability is a property of the actor rather than of its presence in a map, and
defines the default board projection that the two axes together make expressible.

The state sibling separates *where work sits* from *why it is there*. This one separates
*who owns it* from *who is doing it*. Same defect, same shape, same file format, same
adapter — which is why they are planned as a pair.

## Goals

- Record that a human is accountable while an agent executes, which is the normal case
  in an agent-driven repository and is currently inexpressible.
- Keep agent identities out of a shared tracker **by construction**, not by remembering
  to omit them from a config table.
- Push a delegate to Linear when — and only when — the alias names a real Linear app
  user.
- Ship a default board that distinguishes *planned* from *ready* and *paused* from
  *never started*, customizable per repository.
- Report a field that a flow rule excluded, instead of reporting success for a write
  that went nowhere.

## Non-Goals

- **Agent presence.** Which session is touching a bead right now is a TTL lease in a
  database, not a bead field: heartbeat cadence is seconds, `extensions` merges as
  whole-object last-writer-wins, and sync-branch commits are the wrong granularity.
  `delegate` is the durable, low-frequency fact of who a unit of work is assigned to.
- **Registering tbd as a Linear agent** (agent sessions, ACKs, typed activity streams).
  Setting `delegateId` is a plain field write that happens to create an AgentSession on
  Linear’s side; nothing here requires tbd to become an agent.
- **GitHub adapter work.** The model is chosen to fit it; nothing here implements it.
- Re-specifying `resolution`, `hold`, or state resolution.
  That is the sibling spec.

## Background

Found during the same first-time Linear rollout that produced #244 and #245: ~900 open
beads, ~105 mirrored epics, nearly all execution done by coding agents.

`assignee` was in use on **zero** beads there.
Not neglect — there was nothing useful to write.
The human is the same on every bead, so the field carries no information; the agent is
not expressible at all.
Two independent config gates (`field_sync.fields.assignee`, defaulting to `local`, and a
closed `user_map`) also mean the field cannot reach Linear without deliberately opening
both, and neither gate says so when it excludes a field: a push reports
`updated N, skipped 0, failed 0` while the assignee was never a candidate.

tbd’s own source states the assumption that no longer holds:

```js
assignee: FieldFlowRule.default("local")   // "`assignee` stays local because tracker assignees are people"
```

That was right when it was written.
Linear’s 2025 agent platform is what changed: agents are OAuth apps installed with
`actor=app`, they appear in assignment menus under `app:assignable`, and Linear’s stated
taxonomy is **delegation, not assignment** — the issue keeps a human assignee while the
agent is the delegate.
`delegateId`, `agentSession`, `app:assignable`, and `actor=app` appear in **zero** files
in the tbd dist today, so this is new surface rather than a modification.

The governing rule, from the repository this came from: **issues in Linear are managed
per human, not per agent.** Linear is where a person decides what is on their plate.
An agent in the assignee slot answers a question nobody asks there while destroying the
answer to the one they do.

## Design

### Approach

One field beside the existing one, and a value-shape change to the identity table:

```
assignee:  <alias>     # accountable. Unchanged field, unchanged meaning.
delegate:  <alias>     # acting. Absent reads as "same as assignee".
```

```yaml
integrations:
  linear:
    user_map:
      josh: { email: josh@example.com, kind: human }
      claude: { kind: agent }                              # no address: never pushed
      cyrus: { kind: agent, linear_app_user_id: <uuid> }   # pushable as a delegate
```

The bare `alias: email` form keeps parsing as `kind: human`, so every existing config is
valid with no rewrite.

`kind` is what makes the closure a design rather than an omission.
Today the only way to keep an agent out of a shared workspace is to leave it out of
`user_map`, which turns a deliberate policy into an unreported skip and gives the agent
no name in tbd either.
With a kind, an agent alias is a first-class local value that is *known* to be
unpublishable, and the reason is legible at the config.

A Linear agent is an **app user**, not a person with an email, so `user_map`’s current
value domain cannot name one even where you want to — and `delegateId` is a separate
mutation field from `assigneeId` regardless.

### Mapping

| tbd | Linear | GitHub |
| --- | --- | --- |
| `assignee` (`kind: human`) | `assigneeId` | assignee |
| `delegate` (`kind: agent`, no app id) | not pushed; reported as a skip | not pushed |
| `delegate` (`kind: agent`, with app id) | `delegateId` → creates an AgentSession | agent assignment |
| `delegate` (`kind: human`) | `delegateId` | assignee (second) |

Inbound, a Linear delegate that maps to a known alias sets `delegate`; an unknown one
leaves the bead unchanged and warns, matching how unmapped assignees already behave.

### The default board projection

The sibling spec resolves Linear states by name and settles the terminal end.
What the two axes together make newly expressible is the **open** end, which is where a
planning board earns its keep:

| Column | Linear type | tbd condition | Reads as |
| --- | --- | --- | --- |
| **Draft** | `backlog` | `open`, not ready | being planned; spec unfinished |
| **Todo** | `unstarted` | `open`, ready | ready to begin |
| **In Progress** | `started` | `in_progress`, no hold | active now |
| **Paused** | `started` | `in_progress` + `hold: paused` | begun, set down, not abandoned |
| **Blocked** | `started` | `in_progress` + `hold: blocked` | begun, waiting on something |
| **Done** | `completed` | `closed` + `completed` | finished |
| **Canceled** | `canceled` | `closed` + `canceled` | abandoned |

Three observations, each of which is a reason the axes have to land first.

**Draft versus Todo is readiness, which tbd already computes.** `tbd ready` is
first-class — it is how agents pick up work — so the split needs no new field and no
human bookkeeping. A bead whose dependencies are unmet, or whose spec is still being
written, sits in Draft; the moment it unblocks it moves to Todo.
That is the distinction a planning board most wants and the one a flat `open` cannot
draw.

This is an amendment to the sibling’s open-end table, which maps `open` → Todo
unconditionally and `open + paused` → Backlog.
Under this projection, Backlog/Draft is reached by *unreadiness* rather than by an
explicit pause, which is both automatic and closer to what the column means.
The two rules can coexist — an explicitly paused un-started bead is also not ready — but
the precedence should be settled in one place.

**Paused versus Draft is `started_at`.** Both are “not active”, and without a record of
having started they are indistinguishable — exactly the information tbd loses today,
since `deferred` overwrites `in_progress`. Paused is the column that only exists if
`started_at` does, which is the strongest practical argument for `started_at` even ahead
of the rest of the state axis.

**Paused and Blocked are the same Linear type.** Both are `started`, because both
describe work that has begun; they differ by `hold`. Under a flat enum they would have
to be separate positions and would therefore destroy the `in_progress` they modify.

The projection also lines up the three surfaces that currently say the same thing three
different ways — the spec-lifecycle folders from
[#245](https://github.com/jlevy/tbd/pull/245), the bead fields, and the board:

| Spec folder | Bead state | Column |
| --- | --- | --- |
| `draft/` | `open`, not ready | Draft |
| `active/` | `open` ready, or `in_progress` | Todo, In Progress |
| `paused/` | `in_progress` + `hold: paused` | Paused |
| `done/` | `closed` + `completed` | Done |
| `archive/` | `closed` + `canceled` | Canceled |

#245 observed that its `paused/` folder is the spec-level instance of #244’s gap.
This table is that observation finished: one lifecycle vocabulary, three surfaces,
currently expressible on only one of them.

### Provisioning and customization

Same posture as the sibling, for the same reasons: Draft and Paused do not exist on a
stock Linear team, so the map is validated against the team’s real states before any
mutation and fails closed naming what is missing, rather than guessing a neighbour.
Setup offers to create them and never requires them; a team that declines keeps working,
with the missing column collapsing to its type’s default and the collapse reported once.

Customization extends the sibling’s `state_map` rather than adding a second mechanism,
and binding is to state **id** after first resolution by name, so renaming Draft to
Planning does not break the projection.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: KEEP DEPRECATED. `assignee` keeps
  its type and meaning; `delegate` is new and optional.
- **Library APIs**: KEEP DEPRECATED. New field is optional on every create/update path.
- **Server APIs**: N/A.
- **File formats**: SUPPORT BOTH. `delegate` is optional; absent reads as “same as
  assignee”. `f08` preserves unknown keys, so a bead written by a newer tbd survives an
  older one — the same question the sibling raises about a format bump applies here and
  should get one answer for both.
- **Database schemas**: MIGRATE, trivially.
  `user_map` entries in the `alias: email` form are read as `kind: human` with no
  rewrite. No bead needs backfilling.

## Implementation Plan

Depends on the sibling’s Phase 1 resolver.
Phase 1 here is useful without Phase 2.

### Phase 1: The actor axis

- [ ] Add `delegate` to the bead schema; `user_map` values accept the object form with
  `kind`, with the bare-email form parsed as `kind: human`
- [ ] `--delegate` on `tbd create` / `tbd update`, including the bulk path
- [ ] Outbound: `assignee` → `assigneeId`; `delegate` → `delegateId` only when the alias
  carries `linear_app_user_id` or is `kind: human`
- [ ] An agent alias with no app id produces a **reported** skip, never a silent one
- [ ] Inbound: a mapped delegate sets `delegate`; an unknown one warns and leaves the
  bead unchanged
- [ ] Report fields excluded by flow rule under `--verbose`
  (`assignee: not eligible (flow=local)`), and warn when a write can never publish
- [ ] Tests: each mapping row round-trips; the unpublishable-agent case emits a skip; a
  bare-email `user_map` still parses

### Phase 2: The board projection

- [ ] Draft/Todo split driven by existing readiness
- [ ] Extend `state_map` to cover Draft and Paused; validate against real team states
  before mutating and fail closed naming what is missing
- [ ] Offer Draft alongside the sibling’s Paused in `tbd integration setup`; create only
  on confirmation, idempotent by name, explicit trailing `position`
- [ ] `tbd doctor` reports the resolved column for each (status, hold, readiness)
  combination
- [ ] Tests: every row of the projection table; a stock team with neither Draft nor
  Paused degrades correctly and reports once

## Testing Strategy

Unit tests for the actor mapping table, including the three delegate cases, which differ
only by what `user_map` says about the alias.
Round-trip tests through the existing Linear adapter fixtures for assignee,
delegate-as-app-user, and delegate-as-human.

The two silent-gate defects get red-proof tests: a push whose `--verbose` output omits
an excluded field fails, and a write of an unpublishable actor that emits no warning
fails. Both reproduce a real debugging session where a push reported success for a field
that was never eligible.

Board projection is table-driven: each row set locally, pushed, read back, asserted
unchanged, on both a provisioned team and a stock one.

## Rollout Plan

Phase 1 is inert until a repository writes a `delegate`: absent means “same as
assignee”, which is today’s behavior.
Opening the field to Linear still requires the two existing gates, so no workspace
starts receiving assignees because of an upgrade.

Phase 2 changes what a board looks like and is therefore opt-in per repository through
`state_map` plus confirmed provisioning.
A team that provisions nothing sees exactly what it sees today.

## Open Questions

- Field name: `delegate` follows Linear.
  Is a provider-neutral name (`acting`, `worker`) better for a tool that also targets
  GitHub, where the concept has a different shape?
- Should `delegate` default to the acting agent automatically when an agent moves a bead
  to `in_progress`, or always be set explicitly?
  Automatic is convenient and is also how a field quietly becomes presence tracking.
- Precedence between the sibling’s `open + paused` → Backlog rule and this spec’s
  `open, not ready` → Draft.
  Same column, two routes; one of them should be primary.
- Should `kind: agent` aliases be allowed as `assignee` at all, or rejected at write
  time? Rejecting is stricter and matches the governing rule; allowing keeps tbd usable
  for repositories that do not mirror to a tracker.
- Does this need a format bump?
  Same question as the sibling, and it should get one answer covering both sets of
  fields.

## References

- [#246](https://github.com/jlevy/tbd/issues/246) — design discussion and provider
  comparison
- [#244](https://github.com/jlevy/tbd/issues/244) — the state axis
- [#245](https://github.com/jlevy/tbd/pull/245) — spec-lifecycle folders; the third
  surface of the same vocabulary
- [plan-2026-08-18-tracker-state-model-and-linear-mapping.md](./plan-2026-08-18-tracker-state-model-and-linear-mapping.md)
  — the sibling spec and its resolver
- Linear: `IssueUpdateInput.assigneeId` / `delegateId`, `actor=app`, `app:assignable`,
  AgentSession lifecycle
- `packages/tbd/src/integrations/linear/mapping.ts`,
  `packages/tbd/src/integrations/linear/adapter.ts`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
