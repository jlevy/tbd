---
title: Plan Spec
description: Give tbd a terminal resolution and an open-end hold so canceled, duplicate, and paused work can be said out loud; resolve Linear states by name rather than by board position; and project the resulting lifecycle onto an opt-in Linear board that distinguishes planned from ready and paused from never started
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Tracker State Model and Linear Mapping

**Date:** 2026-08-18

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Draft

**Tracked as:** epic `tbd-og20`.

**Design discussion:** [#244](https://github.com/jlevy/tbd/issues/244) — the model, the
provider comparison, and the provisioning posture are argued there and are not re-argued
here. The board-projection evidence comes from the rollout described in
[#246](https://github.com/jlevy/tbd/issues/246).

**Sibling:**
[plan-2026-08-18-actor-axis-and-identity.md](./plan-2026-08-18-actor-axis-and-identity.md)
adds `delegate` beside `assignee` and replaces identity configuration with directory
resolution. Its identity-binding phase reuses this spec’s resolver-and-ask machinery;
neither restates the other.

**Related:**
[plan-2026-08-14-external-sync-and-traceability.md](./plan-2026-08-14-external-sync-and-traceability.md)
covers sync cost, bead metadata, and traceability.
It does not touch status mapping; these two do not overlap.

## Overview

tbd has one terminal status, `closed`, and no way to say work was abandoned rather than
delivered. It also has no way to say work began and stopped.
Linear and GitHub both express the first; Linear expresses the second.
The result is silent, lossy, and bidirectional.

This adds two fields, `resolution` and `hold`, and replaces Linear state resolution by
board position with resolution by name.
It then names the **slot** vocabulary those axes produce and defines the opt-in board
projection that renders slots as Linear columns: a board that distinguishes planned from
ready and paused from never started.

## Goals

- Say `canceled` and `duplicate` outbound, and preserve them inbound, losslessly.
- Say “begun, then stopped” without destroying the fact that work started.
- Stop stamping a completion date on work that was abandoned.
- Resolve a Linear state deterministically, and never on incidental board order.
- Work correctly against a stock Linear team with no configuration and no provisioning.
- Offer a default board that distinguishes *planned* from *ready* and *paused* from
  *never started*, opt-in per repository, without changing anything for repositories
  that decline it.

## Non-Goals

- A general workflow engine.
  The status enum stays a small, fixed lifecycle vocabulary.
- Mirroring Linear’s per-team state *names* into tbd.
  Names are a provider concern; slots are the tbd concept they render.
- Reworking `blocked`/`deferred` into the new `hold` axis.
  They keep working as they do; folding them in is a follow-on once `hold` has proven
  itself.
- The actor axis (`assignee`, `delegate`, identity resolution).
  That is the sibling spec.
- GitHub adapter work.
  The model is chosen to fit it, but nothing here implements it.

## Background

Three symptoms, one cause.
The status enum fuses *where work sits* with *why it is there*, so any modifier has to
overwrite a position.

| Symptom | Today |
| --- | --- |
| Cancel a bead | `closed` → Linear **Done**, plus a `completedAt` stamp |
| A human sets Canceled in Linear | Bead records `closed`; the distinction is erased permanently |
| Pause partly-done work | `deferred` overwrites `in_progress`; that it started is lost |

Measured while reconciling a real repository: two epics tracked plans explicitly marked
`Superseded`, one saying the approach “was never executed as a standalone effort”.
Neither Done nor Backlog was true, and there was no third option.

The same fusion limits the open end.
A planning board most wants the distinction between *ready to begin* and *not yet clear
enough to execute*, and a flat `open` cannot draw it — even though readiness is what
`tbd ready` already computes.

## Design

### Approach

Two orthogonal axes beside the existing status, each valid only at one end of the
lifecycle:

```
status:      open | in_progress | closed        # position; unchanged. Legacy blocked and
                                                # deferred remain valid (see Non-Goals)
                                                # and get slots by the legacy rule below.
resolution:  completed | canceled | duplicate   # only when closed; absent reads completed
duplicate_of: <bead-ref>                        # required when resolution is duplicate
hold:        blocked | paused                   # only when open or in_progress
hold_until:  <timestamp>                        # optional, with hold: paused
started_at:  <timestamp>                        # set on first entry to in_progress, never cleared
```

`status === 'closed'` stays the terminal test and no existing consumer changes.
Absent `resolution` reads as `completed`, so every existing bead stays correct with no
backfill.

Nothing in the codebase wants canceled work in a different lifecycle *position* than
completed work: `ready`, `blocked`, the outbound `statuses` selector, and every status
filter treat terminal work identically.
Encoding the reason as a position would turn every “is this finished” test into a
set-membership check for no gain.

### The slot vocabulary

The axes together, plus readiness, produce a richer set of lifecycle positions than the
status enum can name.
That set needs a name space of its own, because it is what the Linear mapping, the board
columns, and the spec-lifecycle folders from
[#245](https://github.com/jlevy/tbd/pull/245) all independently try to express:

```
backlog | draft | todo | in_progress | paused | blocked | in_review | done | canceled | duplicate
```

A **slot** is the tbd-side lifecycle concept; a Linear state name is one provider’s
rendering of it. Half these slots are not status values at all: `paused` and `blocked`
come from `hold`, `todo` versus `backlog` comes from readiness, and `canceled` and
`duplicate` come from `resolution`. Keying the Linear mapping by slot rather than by
status is what lets one map cover all three inputs.

A slot is computed, never stored: a pure function of `status`, `hold`, `resolution`,
readiness (which `tbd ready` already computes), and the recorded refinement (below), by
fixed precedence, first match wins:

1. `closed` → `done`, `canceled`, or `duplicate`, by `resolution`.
2. `in_progress` + `hold` → `paused` or `blocked`.
3. `in_progress` with a recorded refinement → that refinement (`in_review`, or a team’s
   own named state).
4. `in_progress` → `in_progress`.
5. `open` + any `hold` → `backlog`: held work is by definition not ready to begin,
   whether it is waiting (`blocked`) or set aside (`paused`), and un-started held work
   has no `started`-type column to occupy.
6. `open` and ready → `todo`.
7. `open` → the `backlog` band; whether it shows as Backlog or Draft is the owned
   refinement below.

A bead carrying any `hold` is never `ready` — that rule is what makes step 5 and the
readiness split agree, and it belongs to `tbd ready` itself, not just to this ladder.
First match wins, so a bead that is simultaneously unready and held still lands in
exactly one slot.

Legacy statuses compute a slot by the same rendering they have today: status `blocked`
(a position in the current five-value enum) → slot `blocked`, and status `deferred` →
slot `backlog`, matching `statusToLinear`’s `started`+`tbd:blocked` and
`backlog`+`tbd:deferred` targets.
This rule holds until the fold-in the Non-Goals defer, so a repository that adopts
`state_map` while still holding legacy-status beads has defined behavior for every bead.

### Components

**Canonical model** (`lib/schemas.ts`, `lib/types.ts`): the new fields, with validation
that `resolution` appears only on `closed`, `hold` only on non-terminal, and
`duplicate_of` only with `resolution: duplicate`.

**Mapping** (`integrations/linear/mapping.ts`): the tables below.
This file stays the only place Linear’s vocabulary appears.

**State resolution** (`integrations/linear/adapter.ts`): replaces `stateIdsByType`,
which keeps one id per type and breaks ties by lowest board position.

**Reconcile engine** (`integrations/core/reconcile.ts`): the canonical status field
widens from the five-value enum to the slot vocabulary.
The matrix itself does not change.

**Provisioning** (`tbd integration setup`): the one place board states are created or
repaired, always on confirmation.
Sync never provisions.

**Diagnostics** (`tbd doctor`): reports the resolved state for each slot offline.

### Mapping

Terminal, total and lossless in both directions:

| tbd | Linear state type | GitHub |
| --- | --- | --- |
| `closed` + `completed` | `completed` | `CLOSED` + `COMPLETED` |
| `closed` + `canceled` | `canceled` | `CLOSED` + `NOT_PLANNED` |
| `closed` + `duplicate` + `duplicate_of` | `duplicate` + duplicate relation | `CLOSED` + `DUPLICATE` + `duplicateIssueId` |

`canceled` and `duplicate` are default state types in every Linear team, so this half
needs no provisioning anywhere.
Verified across two teams in one workspace: identical default sets.

Open end, by slot:

| Slot | tbd condition | Meaning | Linear |
| --- | --- | --- | --- |
| `todo` | `open`, ready | ready to begin | `unstarted` (Todo) |
| `backlog` | `open`, not ready or held | not started, not scheduled | `backlog` (Backlog) |
| `draft` | `open`, not ready — human-owned refinement | being planned; not yet clear enough to execute | the `backlog` state named Draft, preserved rather than set |
| `in_progress` | `in_progress`, no hold | actively worked | `started` (In Progress) |
| `blocked` | `in_progress` + `blocked` | begun, waiting | the `started` state named Blocked, else `started` + `tbd:blocked` |
| `paused` | `in_progress` + `paused` | begun, set down, not abandoned | the `started` state named Paused, else `started` + `tbd:paused` |
| `in_review` | `in_progress` — refinement set by a human or a PR integration | under review | the `started` state named In Review, preserved rather than set |

`completedAt` is sent only when `resolution` is `completed`, which fixes the false
completion stamp directly.

The `todo`/`backlog` split needs no new field and no human bookkeeping: readiness is
first-class — it is how agents pick up work — so a bead whose dependencies are unmet
sits in Backlog and moves to Todo the moment it unblocks.
That is the distinction a planning board most wants and the one a flat `open` cannot
draw.

**Paused versus Draft is `started_at`.** Both are “not active”, and without a record of
having started they are indistinguishable — exactly the information tbd loses today,
since `deferred` overwrites `in_progress`. The paused column only exists if `started_at`
does, which is the strongest practical argument for `started_at` even ahead of the rest
of the axis.

**Paused and Blocked are the same Linear type.** Both are `started`, because both
describe work that has begun; they differ by `hold`. Under a flat enum they would have
to be separate positions and would therefore destroy the `in_progress` they modify.

### State resolution: names, not board position

Today a state is chosen by `type`, with the lowest board `position` breaking ties.
That is sound for unambiguous types and wrong as a contract: `paused` has no Linear
*type* — it is a named state of type `started` — and position is the least stable handle
available. A rename is deliberate and visible; dragging a row in the workflow editor is
neither, and today it silently changes where work lands.
One real team already had three `started` states (In Progress, In Review, Paused) before
tbd provisioned anything; a resolver that picks by type has no defensible answer among
them, and the provisioned board below widens the group further.

Resolution order, first match wins:

1. **Configured name** from `state_map` (keyed by slot; below).
2. **Conventional name**, matched exactly and case-insensitively: `Backlog`, `Draft`,
   `Todo`, `In Progress`, `Paused`, `Blocked`, `In Review`, `Done`, `Canceled`,
   `Duplicate`.
3. **The only state of that type**, when the type is unambiguous.
   This covers every case except `started` on a stock team, and needs no lookup.
4. **Ambiguous — ask.** Report the candidates and let the user choose, then write the
   answer into `state_map` so it is asked once.
   Non-interactively, refuse and name the config key rather than guessing, matching how
   the bulk guard already handles an oversized run with no human present.

Board position is not used to decide anything.
Binding is to state **id** after first resolution, so renaming Draft to Planning does
not break the projection; `tbd doctor` reports the name drift so the config can be
updated to match.

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
The config *is* the consent, so no later sync ever prompts.

An optional key is also additive: older tbd ignores what it does not know, and `f08`
preserves unknown keys, so the config half of the format question answers itself.
The bead-field half (`resolution`, `hold`, and the sibling’s `delegate`) is separate and
needs one answer covering both specs.

One wrinkle the map cannot express: `backlog` and `draft` are the same band, and which
one an issue sits in is an owned refinement (below).
The map says where tbd *puts* work that it places; it does not license tbd to move an
issue a person put in Draft.

### Derived position, owned refinement

The projection is not uniformly computable, and the design depends on admitting that
rather than forcing it.

Every slot in the precedence ladder is derived from bead fields — except one
distinction.
**Backlog versus Draft is not derivable at all.** The distinction is whether
planning is actively happening, and no bead field holds that.
A spec that exists but needs rewriting belongs in Backlog; a spec being actively worked
belongs in Draft; `spec_path` cannot tell them apart, and neither can bead count, age,
or label. The honest reading is that Draft means *not yet clear enough to execute on*,
which is a judgment rather than a predicate.

So the unready band has a derived default and an owned refinement: tbd places unready
work in Backlog, and a person moving it to Draft **owns that choice**. tbd must preserve
it — never recompute the column out from under a human on the next sync — while still
moving the issue out of the band entirely when the bead genuinely becomes ready or
started.

This is the `field_sync` ownership question in a new place, and it reuses that
vocabulary rather than inventing one: the coarse band is `merge`, the within-band
refinement is effectively `remote`. The alternative — giving tbd a way to *set* Draft —
would need a new field expressing “being planned”, and that fact does not belong in a
bead when the spec document itself is the artifact under revision.

The same asymmetry applies to In Review, which a human or a PR integration sets and tbd
does not fight.

### Evidence from a provisioned board

This projection is provisioned and running on a real team (`FIN`, 96 issues), which
settles three things the design can assert rather than predict.

**Type-based state resolution is unusable on a rich board.** That board has four
`started` states and two `backlog` states, which is why the name-based resolver comes
first in the implementation order: nothing else here can be built without it.
Custom **statuses** are the mechanism; Linear has no custom *fields* on an issue
(`customFields`, `properties`, and `customField` are all absent from the `Issue` type),
so the workflow state is the only place a lifecycle distinction can live.

**A column reveals; a snooze hides.** `in_progress + paused` has two candidate homes and
they are not equivalent: a named `started` state keeps the work on the board where a
person planning the week can see it, while `snoozedUntilAt` removes it from view until
the date arrives. Observed on a real paused issue: `state.name = Paused`, `startedAt`
set, `snoozedUntilAt` null.
The column is canonical.
Snooze stays a Linear-side layer a human may apply on top — tbd never writes or reads
`snoozedUntilAt`, and `hold_until` remains a tbd-native fact.
An issue a person snoozes is still in its column when it returns; nothing in the
projection depends on visibility.

**Explicit trailing `position` is not a nicety.** Before provisioning, that team’s board
ordered Done, Canceled, and Duplicate *before* In Review and Paused, because the two
`started` states had been created later and landed at positions 1002 and 2018.44 while
the defaults sat at 3, 4, and 5. Terminal columns appeared mid-board.
Provisioning must place a created state explicitly and should offer to repair an
existing board whose order contradicts its own lifecycle.

The projection also lines up the three surfaces that currently say the same thing three
different ways — the spec-lifecycle folders from #245, the bead fields, and the board:

| Spec folder | Bead state | Column |
| --- | --- | --- |
| `draft/` | `open`, not ready | Draft |
| `active/` | `open` ready, or `in_progress` | Todo, In Progress |
| `paused/` | `in_progress` + `hold: paused` | Paused |
| `done/` | `closed` + `completed` | Done |
| `archive/` | `closed` + `canceled` | Canceled |

One lifecycle vocabulary, three surfaces, currently expressible on only one of them.

### The sync algorithm

Everything above rides the engine tbd already has, and the design stands or falls on
that claim, so this section states it against the real code.

The reconcile engine (`integrations/core/reconcile.ts`) is a pure per-field three-way
matrix over **canonical values** with a stored base: unchanged/unchanged does nothing,
one-side change flows, both-changed conflicts resolve by `tie_break`, and
`local`/`remote` ownership short-circuits the matrix with the overwrite reported.
The Linear adapter reduces a workflow state to a canonical status by **type only**
(`mapping.ts: statusFromLinear`), and sends a state id outbound only when the status
field is in the patch (`adapter.ts:794`).

That last fact is why a rich board works by hand today: a human dragging an issue
between two states of the same type (In Progress → Paused) changes nothing canonical, so
the matrix sees unchanged/unchanged and the placement survives.
The design keeps that property and makes it deliberate.

**The change is the canonical vocabulary, not the engine.** The status field the matrix
compares widens from the five-value enum to the slot vocabulary:

- **Local slot** is computed by the precedence ladder above.
- **Remote slot** is resolved from the state **name** through the resolver order.
  A state whose name resolves to no slot is an **owned refinement**: for the matrix it
  reads as its type’s band slot, and its exact state id is recorded so outbound writes
  send it back verbatim.
  In Review and Draft are just the named cases of this rule; a team’s own “In QA” gets
  the same treatment for free.
- **Applying a pull** decomposes the winning slot back onto the bead: `done`/`canceled`/
  `duplicate` set `status: closed` plus `resolution`; `paused`/`blocked` set
  `in_progress` plus `hold`; `todo`/`backlog` set `open`; `draft` and `in_review` set
  the band’s status plus the refinement record, never a status of their own.
- **Applying a push** composes the slot’s mapped state id, falling down the ladder when
  the team lacks the state: mapped state, else carrier label beside the band default
  (`tbd:paused`, `tbd:blocked` — the mechanism `blocked`/`deferred` already use), else
  the band default alone, reported once.

The refinement record needs a durable home, and there are two candidates that both
travel on the sync branch, so the trade-off is merge behavior rather than reach:
`extensions.<provider>` on the bead (bead sync merges `extensions` whole-object
last-writer-wins), or the pair’s link record under `bridge/<provider>/links/` (written
only by sync runs, merged file-by-file like other bridge state).
This is an open question below, to be settled by testing the concurrent-sync behavior
rather than by argument.

Conflicts need no new machinery: a slot is one value, so a human moving an issue to
Paused while an agent closes the bead is both-changed on one field, resolved by
`tie_break` exactly as status conflicts are today.
Echo needs none either: the matrix converges pushes on the next run because the merged
base takes the pushed value.

**Migration of the base.** The stored base for every linked pair holds a five-value
status. On first run with slots, the base statuses are mechanically rewritten to their
slot equivalents (`open` → `todo`-or-`backlog` cannot be recovered, so `open` rewrites
to the band and the first reconcile treats a readiness-split difference as
remote-unchanged rather than a conflict).
Without this, every linked pair would read as locally changed on upgrade and the first
sync would mass-push state writes — the bulk guard would catch the volume, but the
correct number of writes is zero.

### Provisioning: never required, offered, confirmed

1. **Never required.** Every mapping round-trips on stock states.
   Without a Paused state, `in_progress + paused` syncs as `started` + `tbd:paused` —
   the existing `blocked`/`deferred` carrier-label precedent.
   Declining costs a board distinction, not data.
   No sync path may fail or nag because an optional state is absent.
2. **Reuse defaults; never recreate them.** Linear ships Backlog, Todo, In Progress,
   Done, Canceled, Duplicate, In Review in every team.
   tbd must never create a state duplicating a default under another name, and never
   rename, delete, or touch a state outside the map.
3. **Offer, and ask.** A workflow state is team-wide and changes the board for people
   who never run tbd — a larger footprint than anything tbd provisions today, and
   `mirror_labels` already defaults off for a milder version of that concern.
   The written `state_map` is the consent; creation happens in `tbd integration setup`
   on confirmation, and re-runs no-op on states already bound.

Fresh setup proposes the full default map and shows its plan before doing anything:
which slots bind to existing states by name (on a stock team: Backlog, Todo, In
Progress, In Review, Done, Canceled, Duplicate), which states would be created (Draft,
Paused, Blocked), and the explicit position each created state gets — inserted after the
bound state of the preceding slot, so the board reads in lifecycle order.
Confirming writes the `state_map` into config and creates the confirmed states;
declining writes nothing and leaves legacy behavior.

Re-running setup on an existing integration is the re-config path, and it reconciles
three things against the live team: slots in the map with no matching state (offer to
create), states whose positions contradict the slot order (offer to reposition — the
provisioned team above had terminal states sitting mid-board until exactly this repair),
and map names that no longer resolve (bindings hold by id; doctor reports the drift).

Custom mappings are the same mechanism with different content: any subset of slots, any
names. Omitted slots fall down the outbound ladder (carrier label, then band default).
Two slots may name one state; inbound then disambiguates by carrier label and otherwise
reads the plainer slot.
`tbd doctor` prints the full resolved table — slot, state name, state id,
bound-or-missing — offline, so the projection is inspectable without a sync.

## Implementation Plan

Five phases. Phase 1 is useful alone and unblocks everything; each later phase is useful
without the ones after it.
Phase 5 is the dogfooding gate: it ships nothing and exists to prove the rest against
this repository’s own data and board.

### Phase 1: Terminal resolution and name-based state resolution

- [ ] Add `resolution` and `duplicate_of` to the bead schema, with validation tying both
  to `closed`.
- [ ] `tbd close --as completed|canceled|duplicate` (default `completed`), and
  `--duplicate-of` required with `duplicate`. Keep `--reason` as free prose.
- [ ] Map all three terminal cases outbound; send `completedAt` only for `completed`.
  `duplicate` also creates the provider-side duplicate relation from the scalar.
- [ ] Map `canceled` and `duplicate` inbound to `closed` + resolution instead of
  collapsing them.
- [ ] Replace `stateIdsByType` with the four-step resolver; add `state_map` to config,
  keyed by slot.
- [ ] Prompt on ambiguity and persist the answer; refuse non-interactively.
- [ ] `tbd doctor` reports the resolved state per slot, and flags ambiguity.
- [ ] Tests: terminal round trip for each resolution; resolver precedence including the
  multi-`started` case; no `completedAt` on a canceled bead; `ready` and the blocked
  computation unchanged by a `duplicate_of` value; an `f08` client round-trips a bead
  carrying the new fields without stripping them (the test that decides the format-bump
  question).

### Phase 2: Hold, paused, and `started_at`

- [ ] Add `hold`, `hold_until`, and `started_at`, with validation tying `hold` to
  non-terminal status.
- [ ] `tbd ready` excludes beads carrying any `hold`; pinned by test, since the
  todo/backlog split and the slot ladder both depend on it.
- [ ] Set `started_at` on first entry to `in_progress`; never clear it.
- [ ] `tbd pause` / `tbd resume`, and bulk `--hold` on `tbd update` (bulk `--status` is
  refused today, which made deferring a subtree a per-bead loop).
- [ ] Map `open + paused` → Backlog and `in_progress + paused` → the Paused state, with
  the carrier-label fallback when none exists.
- [ ] Map inbound from a Paused-named `started` state; unknown names keep degrading to
  plain `in_progress`.
- [ ] Tests: paused round trip with and without a Paused state; `started_at` survives a
  pause.

### Phase 3: Slots in the engine

- [ ] Widen the reconcile status field from the five-value enum to slots.
  Legacy path (no `state_map`) keeps `statusToLinear` / `statusFromLinear`
  byte-for-byte.
- [ ] Local slot computation with the fixed precedence; pull decomposition back onto
  bead fields.
- [ ] Remote slot resolution by name; unmapped names become owned refinements (band slot
  for the matrix, exact state id preserved outbound).
- [ ] Settle and implement the refinement record’s home (`extensions.<provider>` vs the
  pair’s link record) with its concurrent-sync behavior tested.
- [ ] Base migration on first slot run: statuses rewrite mechanically, zero writes on an
  unchanged repository — pinned by test.
- [ ] Legacy-status beads compute slots by the legacy rule (`blocked` → `blocked`,
  `deferred` → `backlog`) in a `state_map` repository; pinned by test.
- [ ] Outbound ladder: mapped state, else carrier label + band default, else band
  default; reported once per slot.

### Phase 4: Setup, provisioning, and re-config

- [ ] `state_map` optional — absent reproduces today’s behavior with no extra states and
  no prompt; the written config is the consent.
- [ ] Fresh setup proposes the default map: bind by name, create Draft/Paused/Blocked on
  confirmation, explicit positions in slot order.
- [ ] Re-run reconciles map vs live team: missing states (offer create), order
  contradictions (offer reposition), renames (id bindings hold; doctor reports drift).
- [ ] Validate against real team states before mutating; fail closed naming what is
  missing; never rename, delete, or touch states outside the map.
- [ ] Two-slots-one-state allowed; inbound disambiguates by carrier label, else the
  plainer slot.
- [ ] `tbd doctor` prints the resolved slot table (slot, name, id, bound-or-missing)
  offline.
- [ ] Tests: every projection row round-trips on a provisioned team and degrades
  correctly on a stock one; the no-fight property (same-type column moves produce no
  patch); an unmapped custom state survives a full sync cycle; setup idempotence and
  position placement.

### Phase 5: Dogfood the whole model on this repository

Every phase above is provable against the mock server, and the recurring lesson of this
integration is that **a mock is only as good as the constraints it models** — every
defect found live came from the mock being kinder than Linear
([valid-2026-08-16-linear-integration-live.md](./valid-2026-08-16-linear-integration-live.md)).
So the model is not done when its tests pass; it is done when this repository runs on
it. The two axes exist to describe agent-driven work, and this repository is the
agent-driven work they were derived from, which makes it the honest test.

This phase ships nothing new.
It is the acceptance gate for Phases 1-4 plus the sibling’s, and anything it finds is a
defect in those phases rather than work of its own.

- [ ] **Migration on real data, forward and back.** `tbd setup --auto` on this
  repository’s ~900 open beads: the format migration applies, `tbd doctor` is clean, and
  the first `tbd sync` after upgrading writes **zero** state changes (the base-migration
  property, on real data rather than a fixture).
  Confirm an older tbd can still read a bead carrying `resolution`, `hold`, and
  `delegate` without stripping them — the `f08` passthrough claim, verified against a
  real checkout.
- [ ] **Provision the board and see the columns.** Run `tbd integration setup` against
  the tbd Linear project, accept the proposed `state_map`, and confirm the created
  states land in lifecycle order with terminal columns last.
  Then confirm the resolved slot table from `tbd doctor` matches what the board actually
  shows.
- [ ] **Map this work as an epic on that board.** The actor and state axes are tracked
  as epics (`tbd-og20`, `tbd-ncux`) with their phase children; mirror them, assign the
  epics to the accountable human rather than to an agent, and confirm the assignment
  round-trips by Linear user id through a binding rather than a `user_map` entry.
  This is the first real use of the actor axis, and it is deliberately the work itself.
- [ ] **Exercise every column with real beads.** Walk this repository’s own phase beads
  through the lifecycle and confirm each lands in the right column and survives a round
  trip: ready work in Todo, unready in Backlog, claimed work in In Progress with the
  agent as `delegate` and the human still `assignee`, and blocked work in Blocked.
- [ ] **Pause real work and prove the column holds.** Move genuinely stalled beads to
  `hold: paused` — this repository has them, which is what
  [#245](https://github.com/jlevy/tbd/pull/245) measured — and confirm they land in
  Paused, that `started_at` survives, that they are excluded from `tbd ready`, and that
  a human dragging one between two `started` columns produces **no** patch on the next
  sync (the no-fight property, live).
- [ ] **Resume, cancel, and duplicate.** Resume a paused bead back to In Progress; close
  one as `canceled` and confirm Linear shows Canceled with **no** completion date; close
  one as `duplicate` and confirm the duplicate relation exists on the Linear side.
- [ ] **Settle.** Two consecutive syncs report `nothing to do`, and the field-level skip
  reporting names anything that did not publish instead of printing a clean summary over
  a silent no-op.
- [ ] **Reconcile the spec folders against the board.** Run `update-specs-status` and
  confirm the three surfaces agree: a spec in `paused/`, its epic at `hold: paused`, and
  its issue in the Paused column are the same fact said three ways.
- [ ] Record the outcome as a QA playbook beside the live-integration one, so the run is
  repeatable rather than a one-off.

## Testing Strategy

Unit tests for the mapping tables and the resolver, including the ambiguous-type case
and each fallback. Round-trip tests through the existing Linear adapter fixtures for
every terminal resolution and for paused in both provisioned and unprovisioned teams.
A migration test asserting that beads with no `resolution` read as `completed` and that
no existing consumer of `status` changes behavior.
Board projection is table-driven: each row set locally, pushed, read back, asserted
unchanged, on both a provisioned team and a stock one.

## Rollout Plan

Phase 1 is additive: absent `resolution` reads as `completed`, so old beads and older
clients stay correct.
Whether the new fields need a format bump depends on whether a pre-f08 client would
strip them; `f08` preserves unknown keys, so a bump may not be required.
Decide before merge and, if one is needed, fold it into the next planned bump rather
than cutting a format for this alone; the sibling’s `delegate` field belongs in the same
decision.

Phases 2 and 3 ship behind no flag: without a `state_map` nothing changes for existing
users. Phase 4 changes what a board looks like and is therefore opt-in per repository
through `state_map` plus confirmed provisioning.
A team that provisions nothing sees exactly what it sees today.

## Open Questions

Nothing here blocks Phase 1. Each question names the phase that has to answer it, so
implementation can start without resolving them all first.

- **Refinement record home** (Phase 3). `extensions.<provider>` on the bead
  (whole-object last-writer-wins on merge) or the pair’s link record (written only by
  sync runs)? Both travel on the sync branch; the concurrent-sync behavior differs and
  the choice should be settled by testing two clones against one team, not by argument.
- **`blocked` and `deferred` migrating onto `hold`** (after Phase 2, from use).
  A follow-on by design.
  The open part is what happens to the two carrier labels already in the wild, which is
  a question about deployed data rather than about the model.
- **Backlog versus Draft for an un-started paused bead** (after Phase 4, from use).
  The precedence ladder puts it in Backlog.
  Whether that reads better than Draft is a taste call to confirm with use, and changing
  it is one line in the ladder.

Settled:

- **Format bump: assume none, prove it.** `f08` preserves unknown keys, so a client that
  predates these fields should round-trip a bead carrying `resolution` or `hold` without
  stripping them. Phase 1 pins that with a test rather than assuming it.
  A bump is cut only if the test fails, and then jointly with the sibling’s `delegate`
  rather than for one field at a time.
- **`duplicate_of` is a scalar field, not a dependency edge.** tbd’s dependency edges
  mean *blocks*, and `ready` and the blocked computation read them.
  Overloading them with a duplicate relation would change what those queries see for a
  fact that is not a blocking relationship.
  The provider-side relation is the adapter’s job: Linear’s duplicate relation and
  GitHub’s `duplicateIssueId` are created from the scalar, which is exactly the
  translation the mapping layer exists to do.
- **An inbound `canceled` closes a locally-open bead**, as it does today through the
  collapse. It is an ordinary remote status change and goes through the matrix and
  `tie_break` like any other; a special rule for this one transition would be surprising
  in a design whose point is that terminal reasons are not special positions.
- **Snooze is not tbd’s.** The named column is canonical and `snoozedUntilAt` stays a
  Linear-side layer tbd never writes or reads.
- **tbd cannot set Draft.** Preserve-only via the refinement record, since “being
  planned” is a judgment about the spec document rather than a fact a bead holds.

## References

- [#244](https://github.com/jlevy/tbd/issues/244) — design discussion and provider
  comparison
- [#246](https://github.com/jlevy/tbd/issues/246) — the actor axis discussion and the
  rollout that produced the board evidence
- [#245](https://github.com/jlevy/tbd/pull/245) — the spec-lifecycle folders; the third
  surface of the same vocabulary
- [plan-2026-08-18-actor-axis-and-identity.md](./plan-2026-08-18-actor-axis-and-identity.md)
  — the sibling spec
- [plan-2026-08-14-external-sync-and-traceability.md](./plan-2026-08-14-external-sync-and-traceability.md)
- `packages/tbd/src/integrations/linear/mapping.ts` — the current tables
- `packages/tbd/src/integrations/linear/adapter.ts` — `stateIdsByType` and the position
  tiebreak
- `packages/tbd/src/integrations/core/reconcile.ts` — the three-way matrix and ownership
  rules

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
