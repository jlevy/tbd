---
title: Plan Spec
description: Give tbd a terminal resolution and an open-end hold so canceled, duplicate, and paused work can be said out loud, and resolve Linear states by name rather than by board position
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Tracker State Model and Linear Mapping

**Date:** 2026-08-18

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Draft

**Tracked as:** epic `tbd-og20`.

**Design discussion:** [#244](https://github.com/jlevy/tbd/issues/244) — the model, the
provider comparison, and the provisioning posture are argued there and are not re-argued
here.

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

## Goals

- Say `canceled` and `duplicate` outbound, and preserve them inbound, losslessly.
- Say “begun, then stopped” without destroying the fact that work started.
- Stop stamping a completion date on work that was abandoned.
- Resolve a Linear state deterministically, and never on incidental board order.
- Work correctly against a stock Linear team with no configuration and no provisioning.

## Non-Goals

- A general workflow engine.
  The status enum stays a small, fixed lifecycle vocabulary.
- Mirroring Linear’s per-team state *names* into tbd.
  Names are a provider concern.
- Reworking `blocked`/`deferred` into the new `hold` axis.
  They keep working as they do; folding them in is a follow-on once `hold` has proven
  itself.
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

## Design

### Approach

Two orthogonal axes beside the existing status, each valid only at one end of the
lifecycle:

```
status:      open | in_progress | closed        # position; unchanged
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

### Components

**Canonical model** (`lib/schemas.ts`, `lib/types.ts`): the new fields, with validation
that `resolution` appears only on `closed`, `hold` only on non-terminal, and
`duplicate_of` only with `resolution: duplicate`.

**Mapping** (`integrations/linear/mapping.ts`): the tables below.
This file stays the only place Linear’s vocabulary appears.

**State resolution** (`integrations/linear/adapter.ts`): replaces `stateIdsByType`,
which keeps one id per type and breaks ties by lowest board position.

**Provisioning** (`tbd integration setup`): may offer to create a Paused state, and
never requires one.

**Diagnostics** (`tbd doctor`): reports the resolved state for each status offline.

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

Open end:

| tbd | Meaning | Linear |
| --- | --- | --- |
| `open` | not started, scheduled | `unstarted` (Todo) |
| `open` + `paused` | not started, not scheduled | `backlog` (Backlog) |
| `in_progress` | actively worked | `started` (In Progress) |
| `in_progress` + `blocked` | started, waiting | `started` + `tbd:blocked` |
| `in_progress` + `paused` | begun, on hold | the `started` state named Paused, else `started` + `tbd:paused` |

`completedAt` is sent only when `resolution` is `completed`, which fixes the false
completion stamp directly.

### State resolution: names, not board position

Today a state is chosen by `type`, with the lowest board `position` breaking ties.
That is sound for unambiguous types and wrong as a contract: `paused` has no Linear
*type* — it is a named state of type `started` — and position is the least stable handle
available. A rename is deliberate and visible; dragging a row in the workflow editor is
neither, and today it silently changes where work lands.
One real team already has three `started` states (In Progress, In Review, Paused).

Resolution order, first match wins:

1. **Configured name** from `state_map`.
2. **Conventional name**, matched exactly and case-insensitively: `In Progress`,
   `Paused`, `Backlog`, `Todo`, `Done`, `Canceled`, `Duplicate`.
3. **The only state of that type**, when the type is unambiguous.
   This covers every case except `started` on a stock team, and needs no lookup.
4. **Ambiguous — ask.** Report the candidates and let the user choose, then write the
   answer into `state_map` so it is asked once.
   Non-interactively, refuse and name the config key rather than guessing, matching how
   the bulk guard already handles an oversized run with no human present.

Board position is not used to decide anything.

```yaml
integrations:
  linear:
    state_map:
      in_progress: In Progress
      paused: Paused
```

### Provisioning: never required, offered, confirmed

1. **Never required.** Every mapping round-trips on stock states.
   Without a Paused state, `in_progress + paused` syncs as `started` + `tbd:paused` —
   the existing `blocked`/`deferred` carrier-label precedent.
   Declining costs a board distinction, not data.
   No sync path may fail or nag because an optional state is absent.
2. **Reuse defaults; never recreate them.** Linear ships Backlog, Todo, In Progress,
   Done, Canceled, Duplicate, In Review in every team.
   `paused` is the only gap, so it is the only candidate; tbd must never create a state
   duplicating a default under another name.
3. **Offer, and ask.** A workflow state is team-wide and changes the board for people
   who never run tbd — a larger footprint than anything tbd provisions today, and
   `mirror_labels` already defaults off for a milder version of that concern.
   Report it in `tbd integration setup`, create only on confirmation, and no-op on
   re-run matched by name.

When creating, set `position` explicitly after the existing states of that type.
Linear will otherwise place it arbitrarily, and a Paused state sitting above In Progress
is exactly the kind of accident this design is removing.

## Implementation Plan

Two phases. Phase 1 is useful alone and unblocks Phase 2; Phase 2 needs Phase 1’s
resolver.

### Phase 1: Terminal resolution and name-based state resolution

- [ ] Add `resolution` and `duplicate_of` to the bead schema, with validation tying both
  to `closed`.
- [ ] `tbd close --as completed|canceled|duplicate` (default `completed`), and
  `--duplicate-of` required with `duplicate`. Keep `--reason` as free prose.
- [ ] Map all three terminal cases outbound; send `completedAt` only for `completed`.
- [ ] Map `canceled` and `duplicate` inbound to `closed` + resolution instead of
  collapsing them.
- [ ] Replace `stateIdsByType` with the four-step resolver; add `state_map` to config.
- [ ] Prompt on ambiguity and persist the answer; refuse non-interactively.
- [ ] `tbd doctor` reports the resolved state per status, and flags ambiguity.
- [ ] Tests: terminal round trip for each resolution; resolver precedence including the
  three-`started` case; no `completedAt` on a canceled bead.

### Phase 2: Hold, paused, and optional provisioning

- [ ] Add `hold`, `hold_until`, and `started_at`, with validation tying `hold` to
  non-terminal status.
- [ ] Set `started_at` on first entry to `in_progress`; never clear it.
- [ ] `tbd pause` / `tbd resume`, and bulk `--hold` on `tbd update` (bulk `--status` is
  refused today, which made deferring a subtree a per-bead loop).
- [ ] Map `open + paused` → Backlog and `in_progress + paused` → the Paused state, with
  the carrier-label fallback when none exists.
- [ ] Map inbound from a Paused-named `started` state; unknown names keep degrading to
  plain `in_progress`.
- [ ] Offer Paused in `tbd integration setup`: report, confirm, create with an explicit
  trailing `position`, no-op on re-run.
- [ ] Tests: paused round trip with and without a Paused state; provisioning
  idempotence; position placement; `started_at` survives a pause.

## Testing Strategy

Unit tests for the mapping tables and the resolver, including the ambiguous-type case
and each fallback. Round-trip tests through the existing Linear adapter fixtures for
every terminal resolution and for paused in both provisioned and unprovisioned teams.
A migration test asserting that beads with no `resolution` read as `completed` and that
no existing consumer of `status` changes behavior.

## Rollout Plan

Phase 1 is additive: absent `resolution` reads as `completed`, so old beads and older
clients stay correct.
Whether the new fields need a format bump depends on whether a pre-f08 client would
strip them; `f08` preserves unknown keys, so a bump may not be required.
Decide before merge and, if one is needed, fold it into the next planned bump rather
than cutting a format for this alone.

Phase 2 ships behind no flag: without a Paused state nothing changes for existing users,
and provisioning is opt-in by construction.

## Open Questions

- Does this need a format bump, or does `f08` passthrough cover the new fields?
- Should `duplicate_of` be a scalar field or a dependency edge, given Linear and GitHub
  both model duplicate as a relation?
- Should an inbound `canceled` be allowed to close a bead that is open locally?
  It does today via the collapse; with a resolution it deserves an explicit rule.
- Should `blocked` and `deferred` migrate onto `hold` later, and if so, what happens to
  the two carrier labels already in the wild?

## References

- [#244](https://github.com/jlevy/tbd/issues/244) — design discussion and provider
  comparison
- [#245](https://github.com/jlevy/tbd/pull/245) — the spec-lifecycle triage that
  surfaced the paused gap
- [plan-2026-08-14-external-sync-and-traceability.md](./plan-2026-08-14-external-sync-and-traceability.md)
- `packages/tbd/src/integrations/linear/mapping.ts` — the current tables
- `packages/tbd/src/integrations/linear/adapter.ts` — `stateIdsByType` and the position
  tiebreak

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
