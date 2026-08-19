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
| **Backlog** | `backlog` | `open`, not ready — default | not started, not being planned |
| **Draft** | `backlog` | `open`, not ready — human-owned | being planned; not yet clear enough to execute |
| **Todo** | `unstarted` | `open`, ready | ready to begin |
| **In Progress** | `started` | `in_progress`, no hold | active now |
| **Paused** | `started` | `in_progress` + `hold: paused` | begun, set down, not abandoned |
| **Blocked** | `started` | `in_progress` + `hold: blocked` | begun, waiting on something |
| **Done** | `completed` | `closed` + `completed` | finished |
| **Canceled** | `canceled` | `closed` + `canceled` | abandoned |

### Derived position, owned refinement

The projection is not uniformly computable, and the design depends on admitting that
rather than forcing it.

**`open` versus `in_progress` versus terminal is derived** from bead fields, as is Todo
versus the unready band — readiness is what `tbd ready` already computes.
So is every `hold` distinction, and every terminal resolution.

**Backlog versus Draft is not derivable at all.** The distinction is whether planning is
actively happening, and no bead field holds that.
A spec that exists but needs rewriting belongs in Backlog; a spec being actively worked
belongs in Draft; `spec_path` cannot tell them apart, and neither can bead count, age,
or label. The honest reading is that Draft means *not yet clear enough to execute on*,
which is a judgment rather than a predicate.

So the unready band has a derived default and an owned refinement: tbd places unready
work in Backlog, and a person moving it to Draft **owns that choice**. tbd must preserve
it — never recompute the column out from under a human on the next sync — while still
moving the issue out of the band entirely when the bead genuinely becomes ready or
started.

This is the `field_sync` ownership question in a new place, and it should reuse that
vocabulary rather than invent one: the coarse band is `merge`, the within-band
refinement is effectively `remote`. The alternative — giving tbd a way to *set* Draft —
would need a new field expressing “being planned”, and it is not clear that fact belongs
in a bead at all when the spec document itself is the artifact under revision.

The same asymmetry likely applies to In Review, which a human or a PR integration sets
and tbd should not fight.

This is provisioned and running on a real team (`FIN`, 96 issues), which settles three
things the design can now assert rather than predict.

**Type-based state resolution is not merely fragile, it is unusable here.** That board
has four `started` states (In Progress, Paused, Blocked, In Review) and two `backlog`
states (Backlog, Draft).
A resolver that picks by type has no defensible answer for either group, which is the
sibling spec’s name-based resolver earning its place before anything else can be built
on it. Custom **statuses** are the mechanism; Linear has no custom *fields* on an issue
(`customFields`, `properties`, and `customField` are all absent from the `Issue` type),
so the workflow state is the only place a lifecycle distinction can live.

**A column reveals; a snooze hides.** `in_progress + paused` has two candidate homes and
they are not equivalent: a named `started` state keeps the work on the board where a
person planning the week can see it, while `snoozedUntilAt` removes it from view until
the date arrives. Observed on a real paused issue: `state.name = Paused`, `startedAt`
set, `snoozedUntilAt` null.
The named state should be the default and snooze reserved for genuine wake-me-later,
which is the opposite of the sibling spec’s current lean and is worth settling between
them.

**Explicit trailing `position` is not a nicety.** Before provisioning, that team’s board
ordered Done, Canceled, and Duplicate *before* In Review and Paused, because the two
`started` states had been created later and landed at positions 1002 and 2018.44 while
the defaults sat at 3, 4, and 5. Terminal columns appeared mid-board.
Provisioning must place a created state explicitly and should offer to repair an
existing board whose order contradicts its own lifecycle.

Three further observations, each of which is a reason the axes have to land first.

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

### The slot vocabulary and `state_map`

The projection needs a name for each position it can put work in.
That vocabulary is the thing to map from — not `status`, which is only one of the three
inputs.

```
backlog | draft | todo | in_progress | paused | blocked | in_review | done | canceled | duplicate
```

A **slot** is the tbd-side lifecycle concept; a Linear state name is one provider’s
rendering of it. Keying the map by slot rather than by status matters because half these
slots are not status values at all: `paused` and `blocked` come from `hold`, `todo`
versus `backlog` comes from readiness, and `canceled` and `duplicate` come from
`resolution`. The sibling’s example already mixes the two spaces —
`state_map: { in_progress: In Progress, paused: Paused }` keys one entry by a status and
the next by a hold — which is the sign that the key space wants naming properly.

The same vocabulary already appears twice elsewhere: as #245’s spec-lifecycle folders,
and as the board columns.
Naming it once makes those three surfaces projections of one thing rather than three
parallel lists that drift.

### `state_map` is optional, and omitting it changes nothing

```yaml
integrations:
  linear:
    state_map:            # optional; absent = exactly today's behavior
      backlog: Backlog
      draft: Draft
      todo: Todo
      in_progress: In Progress
      paused: Paused
      blocked: Blocked
      in_review: In Review
      done: Done
      canceled: Canceled
      duplicate: Duplicate
```

Absent, tbd behaves as it does now: the stock states, no extra columns, nothing
provisioned, no prompt.
Present, it is an explicit statement of the board a repository wants, and tbd provisions
**only** the states named there and only on confirmation.

This settles the provisioning-footprint question the sibling raises.
That spec argues against creating states freely — a workflow state is team-wide and
changes the board for people who never run tbd, which is why `mirror_labels` already
defaults off — and concludes that Paused should be the sole offered candidate.
An optional map is a better answer than either that restriction or a default that
creates three columns: the richer board is opt-in by writing it down, the config *is*
the confirmation, and a repository that wants none of it never sees a prompt.

It also avoids a config-format bump.
An optional key is additive, older tbd ignores what it does not know, and `f08`
preserves unknown keys — so the config half of the sibling’s open format question
answers itself. The bead-field half (`resolution`, `hold`, `delegate`) is separate and
still needs one answer covering both specs.

Resolution order is the sibling’s, with the map consulted first: configured name, then
conventional name, then the only state of that type, then ask.
Binding is to state **id** after first resolution, so renaming Draft to Planning does
not break the projection.
Validation runs against the team’s real states before any mutation and fails closed
naming what is missing, rather than guessing a neighbour; a named state that does not
exist and is not created collapses to its type’s default, reported once.

One wrinkle the map cannot express: `backlog` and `draft` are the same band, and which
one an issue sits in is the owned refinement above.
The map says where tbd *puts* work that it places; it does not license tbd to move an
issue a person put in Draft.

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
- [ ] Name the slot vocabulary; key `state_map` by slot, not by status
- [ ] `state_map` optional — absent reproduces today’s behavior with no extra states and
  no prompt; present, provision only the states it names, on confirmation
- [ ] Validate against real team states before mutating; fail closed naming what is
  missing
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
  unready band. Same column, two routes; one of them should be primary.
- Should tbd be able to *set* Draft at all, or only preserve it?
  Setting it needs a field meaning “being planned”, and that fact may belong to the spec
  document rather than to a bead.
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
