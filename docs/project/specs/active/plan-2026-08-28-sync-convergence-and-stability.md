---
title: Sync Convergence and Release Stability
description: Make the Linear mirror reach a fixed point, make tbd sync report the tracker surface it actually ran, unblock bead writes after a crashed sync, and repair the gates that hide all of it
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Plan: Sync Convergence and Release Stability

**Date:** 2026-08-28

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Draft

**Tracked as:** epic `tbd-bcss`.

Beads created for this plan carry `--spec` and sit under the epic.
Beads that already belong to another arc (`tbd-dzme`, `tbd-gvju`) keep their original
spec and parent and are referenced here by ID, so neither plan loses its thread.

## Overview

This is a correctness release, not a feature release.
It closes [#265](https://github.com/jlevy/tbd/issues/265), where the Linear mirror never
reaches a fixed point and `tbd sync` does not say so, plus the two adjacent clusters
that make such a defect expensive to find: a crashed sync that silently blocks every
bead write, and a test gate that skips 1,101 golden assertions without failing.

The three clusters are ordered by what they cost the operator.
The first writes wrong data to a live tracker on every run.
The second stops all local work for half an hour.
The third is why the first two reached a release at all.

Every claim below about current behavior is cited to the code that produces it.
Where a cause is inferred rather than confirmed, this document says so explicitly and
names the measurement that would settle it.

## Background: what #265 actually is

The report describes three symptoms on a 136-bead mirror.
Reading the code turns them into four defects, three confirmed by construction and one
confirmed as a reachable path but not yet as the reporter’s specific cause.

### D1: the tracker surface is invisible in `tbd sync` (confirmed)

`reportIntegrationRun` and `reportIntegrationPush` emit their per-provider line through
`this.output.info` (`sync.ts:374`, `sync.ts:388`). `info()` writes nothing unless
`--verbose` or `--debug` is set (`cli/lib/output.ts:419-420`). So a plain `tbd sync`
that folds in the tracker, reconciles it, and writes to Linear prints no tracker line at
all—not a success, not a skip, not a failure.
That is exactly the report’s first symptom, and it is the most damaging because it is
silent.

The codebase already diagnosed this trap one call site earlier.
The skip notice at `sync.ts:167-181` carries the comment:

> This must survive the default invocation: `info()` is verbose-only, so reporting it
> there would leave the ordinary run exactly as silent as before.

That reasoning was applied to the skip path and never carried to the report path.

### D2: a settled pair can have no fixed point (reachable path confirmed; cause in the reporter’s repo not yet confirmed)

A field owned `local` short-circuits the three-way matrix
(`integrations/core/reconcile.ts:413-427`): whenever local and remote are unequal, the
local value is applied to the remote **on every run, independent of `base`**. Ownership
never advances or consults the base, so a pair can be permanently dirty while `base`
agrees with local perfectly.

That is precisely the state the reporter measured.
They verified `base` against title, status and priority (0 differ), `base.slot` against
`refinement_slot` (0 differ), and `remote_updated_at` against live Linear (0 differ).
All of those are `merge` fields or bookkeeping.
Their `field_sync` sets `labels: local` and `assignee: local`. An owned field that
cannot round-trip is invisible to every check they ran.

Labels have a confirmed path that cannot round-trip under default config.
`resolveLabelIds` drops any name it cannot resolve to an id
(`integrations/linear/adapter.ts:1065-1066`), with the deliberate rationale:

> A name with no id and no creation is dropped rather than failing the whole push:
> losing one label is better than losing the status change with it.

`mayCreateLabel` (`adapter.ts:1515-1523`) permits a create only for tbd-owned labels
under the default `labels.create: 'tbd'`. So a bead carrying any repository label that
does not already exist on the Linear team pushes that label, has it silently dropped,
and keeps it locally.
The next run finds the two sides unequal again and pushes again, forever.
Each push bumps Linear’s `updatedAt`, so the following run reads the remote as changed
and swings to pull—the alternation the report describes, on a fixed subset, with the
count stable.

The drop happens inside the adapter, below the reporting layer, so the pair is counted
in `report.pushed`: reported as work done, while the value never left the machine.
This is the same class as the OS-351 defect the engine’s own comments name, recurring
one layer down.

**Not yet confirmed:** that labels (rather than assignee, or description) are the stuck
field in the reporter’s 13 pairs.
Phase 1 builds the diagnostic that answers this before it changes reconciliation.

### D3: dry-run and execute disagree about direction (confirmed)

The dry-run branch populates `report.pushed` and `report.pulled` with no `inboundOnly`
gate at all (`sync-engine.ts:1022-1031`). The execute path records a push only under
`!inboundOnly` (`sync-engine.ts:1306-1310`). The two paths therefore mean different
things by the same word, which is why `tbd --dry-run integration sync --pull` announces
`would push 13`.

The engine documents an intent for this: “the direction gates what is APPLIED, so the
report still names what the suppressed half would have done” (`sync-engine.ts:154-162`).
But only the dry-run path implements it, and the summary renders the suppressed half in
the same vocabulary as work that will happen.
An operator cannot distinguish “this run will push 13” from “13 would push if you ran
the other direction”.

### D4: the one signal that names a stuck field is missing from dry runs (confirmed)

`report.skippedPushes` is populated at `sync-engine.ts:1376-1377`, in the execute path
only. The dry-run branch returns at `sync-engine.ts:1083` before reaching it.
So a dry run never prints the `left divergent` detail lines
(`cli/commands/integration.ts:571-573`), and the `skippedPushes.length === 0` term in
the dry-run `nothingToDo` (`sync-engine.ts:1081`) is inert—the value it tests can never
be non-zero on that path.

The comment on that very line says the detail lines “are behind this early return”.
They are; the fix was never completed.
The result is that the command an operator reaches for to diagnose a stuck mirror is the
one command that cannot report why it is stuck.

## Goals

- **A settled mirror reaches `nothing to do` and stays there.** Two consecutive syncs
  over unchanged data perform no provider writes and report nothing to do, with no owned
  field re-pushing on every run.
- **`tbd sync` never reports success while a surface it ran has pending work.** Every
  invocation that folds in the tracker prints a tracker line at default verbosity.
- **A dry run predicts the run it previews.** Same direction, same counts, same
  vocabulary, and every reason a field cannot converge is named in both.
- **A crashed sync never blocks bead writes for longer than it takes to notice.** A dead
  owner’s lock is reclaimed promptly, and any wait says what it is waiting on.
- **The gates cannot pass while skipping the assertions.** A vitest failure must not
  silently skip the tryscript goldens.

## Non-Goals

- **The state and actor model** ([#244](https://github.com/jlevy/tbd/issues/244),
  [#246](https://github.com/jlevy/tbd/issues/246), epics `tbd-og20` and `tbd-f2kv`).
  Real gaps, feature-shaped, and both touch the same adapter surfaces this plan
  stabilizes. Landing them on top of a reconciler with no fixed point would confuse two
  failure modes.
- **The docs-config redesign arc** (`tbd-up8l`, `tbd-70dj`, `tbd-lizx`, `tbd-29vf`,
  `tbd-j89q`) and **kdex** (`tbd-hch7`, `tbd-yk3p`, `tbd-5hv2`).
- **Session refs** (`tbd-owa5`) and the remaining traceability phases of `tbd-dzme`,
  except the two bugs listed in Phase 1.
- **Performance work.** `tbd-iqgm` (comment fetch is `2+N` per sync) is real and
  adjacent, but it is a cost defect, not a correctness one.
  It is listed in Phase 1 only because the delta-gating it needs is the same delta the
  convergence fix must trust.

## Design

### Phase 1: the mirror reaches a fixed point, and says what it is doing

**Order matters here.** The diagnostic comes first, because D2’s exact cause in a live
repository is not yet confirmed, and changing reconciliation before it can be observed
would be guessing.

**1a. Make the run observable.** (`tbd-8gcz`, `tbd-aypl`)

- Populate `report.skippedPushes` in the dry-run branch, from the same
  `pair.result.skippedPushes` the execute path reads (`sync-engine.ts:1376`). This makes
  the existing `nothingToDo` term at `sync-engine.ts:1081` live rather than inert.
- Add `skipped pushes N` to the summary parts in `printSyncReport`
  (`cli/commands/integration.ts:548-560`). Today it appears only in detail lines, so it
  is absent from the one line an operator reads.
- Add a per-pair divergence diagnostic—the field, the local value, the remote value, the
  base, and the rule that decided it.
  A settled-looking pair that keeps reporting work must be answerable without reading
  `.tbd/data-sync/bridge/` by hand, which is what #265 had to do.

**1b. Close the loop.** (`tbd-u9eg`) With the field named, fix the round-trip.
A push whose value the adapter drops must not be reported as pushed: `resolveLabelIds`
(`adapter.ts:1057-1074`) must return what it dropped, and the engine must record it as a
skipped push rather than counting the pair in `report.pushed`. Then an owned field that
cannot round-trip is visible in the report on the first run instead of alternating
silently forever.

Whether the drop should also stop being a drop—creating the label, or refusing the
push—is a policy question the diagnostic should answer first.
Recording it honestly is correct regardless, and is the part that ends the loop’s
silence.

**1c. Make the two directions agree.** (`tbd-r1a3`) Gate the dry-run `pushed`/`pulled`
population on `inboundOnly` to match the execute path (`sync-engine.ts:1022-1031`
against `:1306`), and render the suppressed half in its own vocabulary rather than the
verb for work that will happen.

**1d. Make the tracker line visible.** (`tbd-10zb`) Convert `reportIntegrationRun` and
`reportIntegrationPush` (`sync.ts:353-392`) from `output.info` to `output.notice`,
matching the skip path that already made this choice.
A folded run that did nothing should still say so.

Also in Phase 1, because they are the same surface and the same report:

- `tbd-42u4`: `tbd --dry-run sync` and `tbd sync --status` never cover the tracker.
  Same honesty defect as D1, one command over.
- `tbd-bexc`: malformed managed markers freeze comments and pulls for a pair, not just
  the description, with no way to find a quarantined pair.
- `tbd-1emr`: sync’s duplicate-link failure names a UUID where doctor names the issue
  key.
- `tbd-iqgm`: gate the comment fetch on the delta (cost, but it shares the delta the
  convergence work must trust).
- `tbd-pn03`: a changed `team_key` pushes the new team’s workflow-state UUID at old-team
  issues, failing per item on every sync, forever.
  The same never-converges shape from a different direction.

### Phase 2: a crashed sync must not block bead writes

Three beads are one root cause: `tbd-pht1`, `tbd-iiys`, and `tbd-sndk`.

`DATA_SYNC_LOCK_OPTIONS` sets `staleMs` to 30 minutes, and the PID-liveness check
(`ownerIsDefinitelyDead`, `utils/lockfile.ts:276-288`) sits inside the age gate
(`lockfile.ts:716-726`) rather than in front of it.
So a lock whose owner is provably dead on this host is still held for the full 30
minutes, and every `tbd create` and `tbd update` blocks with no message.

- Make provable death a fast path, not a special case of age.
  ESRCH already excludes the suspended-process case the age gate exists to protect.
- Print a waiting-on-lock notice naming the holder pid and the expected stale time, so a
  wait is legible instead of looking like a hang.
- Reclaim ownerless empty lock directories on acquisition.
- Teach `tbd doctor` to flag a stale lock.
  It currently checks only parent-directory writability and calls the repository
  healthy, which is how `tbd-pht1` went unnoticed.

Then the adjacent sync robustness bugs, each independent:

- `tbd-az97`: `origin/tbd-sync` missing in a single-branch clone breaks the first
  `tbd create`.
- `tbd-g2fd`: diff3 conflict markers bypass `MergeConflictError`, so a common git
  configuration gets the worst error message in exactly the case the good one was
  written for.
- `tbd-82dw`: false push-failure reporting under concurrent metadata sync.

### Phase 3: repair the gates, then the papercuts

**The gate defect comes first, because it hides everything else.** `test:coverage` is
`vitest run --coverage && tryscript run …`, so any unrelated vitest blip skips all 1,101
golden assertions silently: the command reports the vitest failure and never says the
goldens did not run (`tbd-7q6v`). Fix the `&&` independently of, and before, any flake
work: a green run must mean the goldens ran.

Then the isolation leak, which is three beads and one bug: `tbd-3etj`, `tbd-wul8` and
`tbd-f6y4` all describe a test path running `setup` against the real repository, so
`pnpm test` stamps the developer’s own `.tbd/config.yml` and regenerates tracked skill
files.
On CI this is invisible; locally it dirties the tree after every run and risks the
churn riding into an unrelated PR.

Then the wall-clock flakes, which should be triaged together rather than one at a time:
`tbd-2pqp`, `tbd-n7ll`, `tbd-6p9s`, `tbd-v7qn`, `tbd-vugg`, `tbd-j3q1`. They share one
cause: budgets that measure the machine rather than the code.
`tbd-j3q1` is different in kind and cheap: a fixture ID can land within
suggestion-edit-distance of the probe ID, so use a probe that cannot collide.

Finally the correctness papercuts, each small and each currently able to mislead an
agent:

- `tbd-pjan` / [#204](https://github.com/jlevy/tbd/issues/204): `findTbdRoot` walks past
  git boundaries with no `.git` sentinel, so tbd can read and write a different
  repository’s database than the one the operator is in; and `extractShortId` ignores
  the ID prefix entirely, so on a short-ID collision `update` and `close` mutate the
  wrong repository’s issue.
  The highest-severity item in this phase.
- `tbd-v8lv`: `--defer-before` is declared, documented in help, and never read.
- `tbd-5av0`: `deferred_until` does not remove a bead from `tbd ready`, so the field
  reads as scheduling and changes nothing.
- `tbd-649r`: `show --json` returns `null` for notes on first write while the text view
  shows them, breaking agent write-then-read-back.

Agent-surface accuracy, grouped because they are one edit each and all mislead an agent
that reads only what tbd generates:

- `tbd-fnwc` / [#254](https://github.com/jlevy/tbd/issues/254): the session hook
  prepends `/usr/local/bin`, shadowing a newer Node, then misreports the failure as a
  format incompatibility, and the npx fallback runs under the same wrong Node so it can
  never recover.
- `tbd-a0sl` / [#238](https://github.com/jlevy/tbd/issues/238): `SKILL.md` never says
  beads live on the `tbd-sync` branch, and its one branch sentence implies the opposite.
- `tbd-eidy`: committed agent surfaces are stale against bundled docs; consider a CI
  check that fails when a clean `tbd setup --auto` produces a diff.
- `tbd-351n`: `setup --auto` overwrites a pinned `get-tbd` version with `@latest`, which
  silently reverts a repository’s supply-chain policy on every run.

## Testing Strategy

**The convergence fix is red-green or it is nothing.**
`tests/helpers/linear-mock-server.ts` already models a team whose label set is fixed
(`Bug`, `Feature`, `linear-mock-server.ts:106-108`), which is exactly the condition that
makes `resolveLabelIds` drop a name under `labels.create: 'tbd'`.

The first commit of Phase 1 is a failing test that:

1. Links a bead carrying a label absent from the mock team, with `labels: local`.
2. Runs the sync twice over otherwise unchanged data.
3. Asserts the second run reports nothing to do.

That test must fail first, for the stated reason, before any reconciliation change.
If it passes, the label hypothesis is wrong for the general case and the diagnostic from
1a is what identifies the real field, which is why 1a ships first.

Beyond that:

- A dry run and the execute run over identical state must agree on direction and counts.
  Assert it as a property over the existing engine tests rather than case by case, since
  D3 is precisely two paths drifting apart.
- The lock work needs a test that takes the lock, kills the owner, and asserts a write
  proceeds promptly rather than after `staleMs`.
- The gate fix is verified by making vitest fail deliberately and asserting the goldens
  still run.

## Rollout Plan

Each phase is independently shippable and none blocks the others, but the release should
not go out with Phase 1 partially done: D1 and D3 are what make D2 hard to see, so
shipping the convergence fix without the reporting fixes leaves the operator unable to
confirm it worked.

`tbd-7q6v` (the `&&`) is worth landing first regardless of phase order.
Until it is fixed, no run of the suite proves what it appears to prove, including runs
verifying this plan’s own work.

Release notes should lead with the convergence fix and say plainly that mirrors which
never settled will settle after upgrade, and that a previously silent `tbd sync` now
prints a tracker line.

## Open Questions

- **Should a label tbd cannot create be created, refused, or dropped-and-reported?**
  Phase 1b records it honestly regardless; the policy choice needs the diagnostic’s
  answer about how often this happens in practice.
  Related: `tbd-b7cy`, already flagged as a human decision about workspace scope.
- **Does the suppressed half belong in the report at all?** The engine argues yes
  (`sync-engine.ts:154-162`). If it stays, it needs its own vocabulary; if it goes,
  `--pull` becomes a genuine narrowing of the plan.
  Either resolves D3; they differ in what an operator learns.
- **`identity.user_map` is empty in this repository, so assignee sync is skipped and
  every sync emits two warnings** (`tbd-klgh`). With `assignee: local`, that is a second
  candidate for a permanently divergent owned field, and it should be checked against
  the same diagnostic as labels.

## References

- [#265](https://github.com/jlevy/tbd/issues/265): the report this plan closes
- [#204](https://github.com/jlevy/tbd/issues/204),
  [#238](https://github.com/jlevy/tbd/issues/238),
  [#254](https://github.com/jlevy/tbd/issues/254)
- [Linear integration design](../../../../packages/tbd/docs/references/linear-integration-design.md):
  read before changing sync behavior
- [plan-2026-08-14-external-sync-and-traceability.md](./plan-2026-08-14-external-sync-and-traceability.md):
  the traceability arc these bugs sit inside
- `tbd guidelines tbd-sync-troubleshooting`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
