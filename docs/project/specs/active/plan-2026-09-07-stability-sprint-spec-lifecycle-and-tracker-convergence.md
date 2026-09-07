---
title: "Stability Sprint: Spec Lifecycle, Triage Views, Bulk Contract, and Tracker Convergence"
description: One plan for the open issue backlog. Make spec links survive moves and branches, give epic and spec triage first-class views, let bulk update carry --parent and --spec, make the Linear mirror converge and report honestly, and stop the CLI from silently operating in the wrong repository or runtime.
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Plan: Stability Sprint: Spec Lifecycle, Triage Views, Bulk Contract, and Tracker Convergence

**Date:** 2026-09-07

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Draft

**Tracked as:** epic `tbd-ct4z`. Beads created for this plan carry `--spec` and sit
under the epic. Beads that already belong to another arc (`tbd-bcss`, `tbd-dzme`) keep
their spec and parent and are referenced here by ID.

## Overview

Eight issues were filed on 2026-09-07 from one reconciliation pass over a large
repository ([#269](https://github.com/jlevy/tbd/issues/269) through
[#276](https://github.com/jlevy/tbd/issues/276)). Ten older issues were already open.
Read together, the eighteen describe five underlying defects, not eighteen feature
requests:

1. A bead’s spec link is a path validated once against one checkout and never maintained
   afterward, while specs move between lifecycle folders and live on branches as a
   normal part of the process.
2. `tbd list` projects a flat, open-only, text-first view, so aggregate facts (how many
   children does this epic have, is this bead linked to a tracker) are not available to
   agents without scratch scripting.
3. The bulk-update contract refused two shared-value fields as if they were per-issue
   fields, so a spec move is dozens of single calls.
4. The tracker reconciler counts standing conditions as pending work, the umbrella
   `tbd sync` flattens the tracker report to one line and prints a remedy naming a flag
   it does not have, and one inbound patch writes a record the schema refuses.
5. The CLI trusts its environment: it can resolve to another repository’s database and
   run under the wrong Node with a misleading diagnosis, each silently.

This plan fixes the five defects and, in doing so, closes or resolves fourteen of the
eighteen issues. Three of the remaining four are already fixed on `main` and only need
closing; one is the state model’s next phase and stays in its own spec.

The plan builds on the unmerged 2026-08-28 stability branch, which already fixed four of
the five defects behind [#265](https://github.com/jlevy/tbd/issues/265). Landing that
branch is Phase 0.

Every claim below about current behavior cites the code that produces it.
Where a cause is inferred rather than confirmed, the text says so.

## Issue Map

| Issue | Root cause | Phase | Disposition |
| --- | --- | --- | --- |
| [#269](https://github.com/jlevy/tbd/issues/269) bulk `update` refuses `--parent` and `--spec`; no `spec move` | 3, 1 | 3, 2 | Fix |
| [#270](https://github.com/jlevy/tbd/issues/270) no epic view with total versus open children | 2 | 3 | Fix |
| [#271](https://github.com/jlevy/tbd/issues/271) `list --specs` open-only; no `--linked` filter | 1, 2 | 2, 3 | Fix |
| [#272](https://github.com/jlevy/tbd/issues/272) `max_nesting` skips deep epics silently | 4 | 1 | Fix |
| [#273](https://github.com/jlevy/tbd/issues/273) `update --spec` validates against one checkout | 1 | 2 | Fix |
| [#274](https://github.com/jlevy/tbd/issues/274) `update-specs-status` shortcut’s two wrong instructions | 1, 2 | 5 | Fix, after 2 and 3 |
| [#275](https://github.com/jlevy/tbd/issues/275) doctor misses three kinds of spec drift | 1 | 2 | Fix |
| [#276](https://github.com/jlevy/tbd/issues/276) full sync hides pending updates; no `--yes` | 4 | 1 | Fix |
| [#267](https://github.com/jlevy/tbd/issues/267) valid duplicate close rejected on the Linear path | 4 | 1 | Fix |
| [#265](https://github.com/jlevy/tbd/issues/265) Linear sync never converges | 4 | 0, 1 | Land the branch; fix the slot asymmetry (1h); confirm with `--explain` on the reporter’s mirror |
| [#204](https://github.com/jlevy/tbd/issues/204) repo resolution crosses git boundaries | 5 | 4 | Fix (`tbd-pjan`) |
| [#254](https://github.com/jlevy/tbd/issues/254) session hook shadows Node, misreports the cause | 5 | 4 | Fix (`tbd-fnwc`) |
| [#179](https://github.com/jlevy/tbd/issues/179), [#180](https://github.com/jlevy/tbd/issues/180) CI-watch reminder on `gh pr create` | surfaces | 5 | Fix, small |
| [#181](https://github.com/jlevy/tbd/issues/181) forked-shortcut customization workflow | surfaces | 5 | Fix, docs plus one setup change |
| [#238](https://github.com/jlevy/tbd/issues/238) SKILL.md does not say beads live on `tbd-sync` | surfaces | 5 | Already fixed (`skill-baseline.md:148`); close |
| [#255](https://github.com/jlevy/tbd/issues/255) bootstrap points at the broker consequence | surfaces | 5 | Already fixed (`ensure-gh-cli.sh:264-270`, `skill-baseline.md:180`); close |
| [#195](https://github.com/jlevy/tbd/issues/195) gh guidance never reaches agents | surfaces | 5 | Already fixed (`setup-github-cli.md:192`, `setup.ts:1021`); close |
| [#244](https://github.com/jlevy/tbd/issues/244) state model: canceled, duplicate, hold | model | none | Own spec (`plan-2026-08-18-tracker-state-model-and-linear-mapping.md`); this plan fixes only the shipped-phase defect #267 and corrects two checkboxes |
| [#246](https://github.com/jlevy/tbd/issues/246) actor axis | model | none | Own spec (`plan-2026-08-18-actor-axis-and-identity.md`), epic `tbd-f2kv` in progress |

## Goals

- **A spec link survives the spec’s lifecycle.** A bead whose spec moved folders, lives
  on an unmerged branch, or was duplicated is classified as such by one resolver, and
  doctor, `tbd spec status`, and `list --specs` all say the same thing about it.
  A spec move is one command that moves the file, rewrites inbound links, and repoints
  beads.
- **Epic and spec triage are single calls.** “Is this epic finished or never
  decomposed?” and “which active specs have no open bead?”
  are answered by one command each, in text and JSON, without reading bead files.
- **The bulk contract is the rule it claims to be.** Any flag whose one value applies to
  every ID works in bulk.
  The refusal message and the design doc list the same set.
- **A settled mirror reports itself settled, and an unsettled one says why.** Standing
  conditions are reported as exclusions, never as pending work.
  `tbd sync` prints the same tracker line as `tbd integration sync`, names the blocking
  cause, and accepts `--yes`.
- **tbd never operates silently in the wrong place.** A cwd inside repository A cannot
  resolve to repository B’s database; a foreign-prefix ID is an error; the session hook
  runs under the Node the session chose and names the real cause when it cannot.
- **Agent-facing instructions match the tool.** The `update-specs-status` shortcut uses
  the commands this plan adds and is pinned by a test.

## Non-Goals

- **The state model’s remaining phases**
  ([#244](https://github.com/jlevy/tbd/issues/244): `hold: paused`, name-aware state
  resolution, provisioning) and **the actor axis**
  ([#246](https://github.com/jlevy/tbd/issues/246)). Both have active specs and touch
  the same adapter surfaces; landing them on top of a reconciler that has just reached a
  fixed point is a separate decision.
- **Phases 2 and 3 of the 2026-08-28 stability plan** (lock recovery, test-gate
  integrity, wall-clock flakes).
  They stay in that plan.
- **A GitHub tracker adapter**, `tbd -C <path>`, and repo identity in every `--json`
  payload. The last two are filed as follow-on beads; see Phase 4.
- **Performance work** on the sync path (`tbd-iqgm`).

## Background: Five Root Causes

### 1. A spec link is a path, validated once, then abandoned

`spec_path` is validated at write time only, by `resolveSpecArg`
(`lib/project-paths.ts:263-290`): a literal path is checked with `fs.access` against the
working tree (`project-paths.ts:182-200`), and a bare filename is matched against every
`.md` under `docs/` (`SPEC_SEARCH_ROOT`, `project-paths.ts:229`). Nothing in the
codebase validates a *stored* `spec_path` afterward: `grep spec` in `doctor.ts` returns
only two comment citations.

Meanwhile the process moves specs.
The Speculate layout has `active/`, `done/`, `future/`, and `paused/` lifecycle folders,
and a plan is expected to move between them.
The reporter measured the result on one pass: 279 of 941 beads carrying a `spec_path`
named a file that had moved, 213 of them repairable mechanically because exactly one
file of that basename existed elsewhere; 30 of 137 open epics had no `spec_path` at all;
one plan sat in both `active/` and `done/` for weeks with beads pointing at both
([#275](https://github.com/jlevy/tbd/issues/275)). Doctor reported the repository
healthy throughout.

The read side already treats the basename as the spec’s identity: `matchesSpecPath`
(`lib/spec-matching.ts:31-65`) matches on exact path, then suffix, then bare filename,
and `resolveSpecArg` searches by basename.
The `plan-YYYY-MM-DD-name.md` convention makes basenames unique in practice.
What is missing is applying that identity *after* the write: repointing a moved spec,
reporting a duplicated one, and recognizing one that exists on another branch.
The last case is the branch-store mismatch behind
[#273](https://github.com/jlevy/tbd/issues/273): beads live in a branch-independent
store shared through the git common directory, while a spec lives in one branch’s tree,
so validating against one checkout is a category error.
The only git-backed existence check today is `findBranchContaining`
(`integrations/core/permalink.ts:75-90`), used for permalinks.

The `update-specs-status` shortcut compensates for all of this by hand
(`update-specs-status.md:154-161`, `:170-184`, `:233-238`), which is how
[#274](https://github.com/jlevy/tbd/issues/274) found two of its instructions wrong in
practice.

### 2. `list` is a flat projection of open beads, designed for text

The `list` JSON projection (`cli/commands/list.ts:80-98`) emits `id`, `internalId`,
`parentId`, `priority`, `status`, `kind`, `title`, `description`, `assignee`, `labels`,
`spec_path`, and `child_order_hints`. It omits `extensions`, so a tracker link cannot be
filtered on; `parentId` is a display id while `child_order_hints` are internal ids, so a
consumer joining them against `id` gets zero children for every epic (the shortcut
warns: “if every epic looks closable, that is the bug”, `update-specs-status.md:243`).
`--specs` grouping lives only in the text formatter (`list.ts:108-112`, `:145-189`), so
`--specs --json` silently emits the flat array.
Closed beads are excluded unless `--all` (`lib/issue-query.ts:124`), which is correct,
but nothing counts children across both states, so an epic whose children all closed and
an epic that never had children look identical
([#270](https://github.com/jlevy/tbd/issues/270)). Triaging 137 epics with
`tbd list --all --parent <id> --count` is 274 calls.

### 3. The bulk contract confused shared-value fields with per-issue fields

`runBulk` (`cli/commands/update.ts:313-349`) refuses `--parent` and `--spec` alongside
`--title`, `--description`, `--notes`, `--from-file`, `--status`, and `--child-order`.
The first two take one value that applies identically to every ID, exactly like
`--priority`. The single-issue path adds three side effects the bulk loop lacks: the
cycle and depth check (`update.ts:176-195`, `lib/issue-hierarchy.ts:52-83`), spec
inheritance from the new parent (`update.ts:203-213`), and appending to the new parent’s
`child_order_hints` (`update.ts:239-255`). That append is copy-pasted in
`create.ts:222-238` and `integration-runner.ts:623`, and nothing anywhere removes a
child from its *old* parent’s hints (`schemas.ts:300-303` documents the resulting stale
ids). Three sources of truth already disagree about the allowed set: the code message
(`update.ts:345-346`), the design doc prose (`tbd-design.md:3021-3023`, which omits
`--delegate` and `--hold`), and the flag table.

### 4. The reconciler counts standing conditions as pending, and the umbrella flattens the report

Four separate defects, three of them one line each.

**Exclusions count as work.** A bead deeper than `max_nesting` within the outbound
selection is skipped (`integrations/core/sync-engine.ts:887-902`, `mirror.ts:227-239`),
and the skip set is a term in both `nothingToDo` computations (`sync-engine.ts:1076`,
`:1678-1692`). The skip is recomputed from the issue graph on every run and nothing can
change it except re-parenting or a policy change, so a repository with one permanently
deep bead can never report `nothing to do`
([#272](https://github.com/jlevy/tbd/issues/272)). The 2026-08-28 plan found the same
shape in a standing mapping warning and fixed it (`tbd-p40p`); the nesting skip is the
next instance.

**Three printers, three vocabularies.** `printSyncReport`
(`cli/commands/integration.ts:540-586`) prints `would push / would pull / skipped`,
where `skipped` never takes the `would` prefix; the mirror-only printer
(`integration.ts:437-476`) prints
`created / updated / skipped / fields not pushed / failed`; the fold inside `tbd sync`
(`cli/commands/sync.ts:353-394`) prints
`would push / would pull / would create / conflicts / failures` and omits `skipped`
entirely. So the run an operator actually performs at session end is the one that cannot
show a nesting exclusion.

**The blocked run cannot say what is behind it.** `reports` is declared inside the `try`
in the fold (`sync.ts:1231-1243`) and is out of scope in the `catch` (`:1248-1254`), so
the warning has only the error message: one failing item, or the bulk-guard refusal.
The bulk guard refuses before any item is attempted (`sync-engine.ts:1008-1020`,
`bulk-guard.ts:34-62`) and its remedy says “Re-run with `--yes`”, but `tbd sync` has no
`--yes` (`sync.ts:1548-1565`); under the default `on_tbd_sync: guarded` posture
(`provider-settings.ts:181-214`) the fold runs with `assumeYes: false`, so an oversized
run fails with advice for a different command
([#276](https://github.com/jlevy/tbd/issues/276)). `assertIntegrationReportsHealthy`
names only the first failure (`sync.ts:396-414`).

**One inbound patch breaks the terminal-axis invariant.** The schema requires
`duplicate_of` only with `resolution: duplicate` (`lib/schemas.ts:392-397`), enforced at
`writeIssue` (`file/storage.ts:74`). The inbound `beadPatch` application
(`sync-engine.ts:1383-1398`) spreads `resolution` from the patch over the stored bead
but never touches `duplicate_of`, and `BeadPatch` has no such field
(`integrations/core/reconcile.ts:102-127`). Three paths set a non-duplicate resolution
on a bead that carries the pointer: slot decomposition returns `resolution: null` for a
non-terminal slot (`sync-engine.ts:747-751`, `slots.ts:161-177`); an inbound `duplicate`
is deliberately downgraded to `canceled` (`sync-engine.ts:806-810`); any other inbound
resolution is copied (`:817`). Each produces a record the write boundary rejects with
the message [#267](https://github.com/jlevy/tbd/issues/267) quotes, on every sync,
forever. `reopen.ts:139-144` already shows the correct pattern: clear both fields
together.

**The alternation has a mechanism the mock server cannot show.** The local slot is
computed from `status`, `hold`, `resolution`, and readiness only (`localViewOf`,
`sync-engine.ts:209-231`, the sole caller of `computeSlot`); a bead has no field for a
*refinement* such as `in_review` or `draft`, and the pull path discards the refinement
it decomposes (`sync-engine.ts:745-751` applies `status`, `hold`, and `resolution` and
nothing else). So for a pair whose Linear column is “In Review” (`slotFromLinear`,
`linear/mapping.ts:365-367`), once the link record carries an exact slot: run *n* sees
remote `in_review` differ from base and pulls it, writing the bead and setting base to
`in_review`; run *n+1* recomputes local `in_progress`, which differs from base, and
pushes it back. The refinement replay (`sync-engine.ts:795-801`) cannot help, because it
fires only when the recorded refinement slot equals the outbound slot, and the outbound
slot can only ever be `in_progress`. With `tie_break: newest`, each pull makes the bead
newest and each push makes the remote newest, which is the perfect alternation the
reporter measured. The loop becomes permanent when the state push is a silent no-op:
`adapter.ts:1030-1032` sets `input.stateId` only `if (stateId)`, with no `else`, and
`stateIdsByType[type]` is unset whenever a team has several states of one type and none
is configured or conventionally named (`adapter.ts:796-803`, `resolveStateId`). The push
then succeeds, bumps `updatedAt`, and counts as pushed while the column never moves.
Two further facts fit: link records created by the outbound or import paths carry no
`slot` (`sync-engine.ts:1574-1590`, `:1740-1752`), so a mirror can sync quietly for a
while and start churning a fixed subset the first time a record is rewritten with an
exact slot; and the existing “does not drag an issue back out of a column” test
(`tests/integrations-sync-engine.test.ts:938-964`) stops at the second run, before the
base becomes exact. This mechanism is confirmed from the code; that it is the reporter’s
13 pairs is the hypothesis Phase 0 tests against their team’s workflow states.

**Two smaller honesty gaps.** The git summary counts only the commit made before the
fold (`sync.ts:1116-1119`), not the fold’s own `tbd integration: sync` commit, so a
`tbd sync` that pulled 13 beads prints `Already in sync` (`sync.ts:1384-1391`). And a
pulled description containing a `## Notes` heading is split at that heading on read-back
(`file/parser.ts:74-83`, `:130-131`), so the next run pushes the truncated prose: it
converges in two runs, but loses text.

**What the 2026-08-28 branch already fixed.** `claude/tbd-sync-bugs-review-f1qb1f`
(three commits, seven files, +785/−9) makes the fold print its tracker line at default
verbosity (`tbd-10zb`), stops a standing mapping warning from holding `nothingToDo`
false forever (`tbd-p40p`), makes dry-run and execute agree on direction and populates
`skippedPushes` on dry runs (`tbd-r1a3`, `tbd-8gcz`), and ships
`tbd integration sync --explain`, which names the field, direction, and rule behind
every dirty pair (`tbd-aypl`). `git merge-tree` against `origin/main` reports no
conflicts; `main` has moved seven commits since.
What remains of #265 is the 13-pair alternation itself (`tbd-u9eg`), which the branch
could not reproduce against the mock server and which `--explain` on the reporter’s
mirror is designed to name.

### 5. The CLI trusts its environment

`findTbdRoot` (`file/config.ts:281-298`) walks from cwd to the filesystem root looking
for `.tbd/config.yml` with no git sentinel, so a nested repository without `.tbd/`
resolves to the enclosing repository’s database, reports it under the inner path, and
materializes the outer repository’s hidden worktree and locks, exit 0
([#204](https://github.com/jlevy/tbd/issues/204)). `extractShortId`
(`lib/ids.ts:181-184`) strips any alphabetic prefix without comparing it to the
repository’s, so `tbd show zzz-fiba` returns `fsq-fiba`, and on a short-id collision a
bulk `close` mutates the wrong repository’s issue.
`tbd status` prints cwd under `Repository:` (`status.ts:109`) where doctor prints the
resolved root.

The generated session hook prepends `/usr/local/bin` to `PATH` (`setup.ts:304`, `:426`,
`docs/install/ensure-gh-cli.sh:31`), demoting a newer Node the session placed first;
`tbd_local_can_read_repository()` (`setup.ts:281-283`) cannot distinguish “Node too old”
from “format incompatible” because it discards stderr, so it prints a format diagnosis
for a Node failure; and the `npx` fallback runs under the same Node, so it cannot
recover ([#254](https://github.com/jlevy/tbd/issues/254), confirmed again on 0.8.1 on
2026-09-05). Both defects have beads under earlier plans (`tbd-pjan`, `tbd-fnwc`) and
neither has shipped.

## Design

### Phase 0: Land the 2026-08-28 stability branch

Rebase `claude/tbd-sync-bugs-review-f1qb1f` onto `main`, run the integration suites
(`tests/integrations-sync-engine.test.ts`, `tests/integration-cli-e2e.test.ts`, the
`cli-sync*` tryscripts), open the PR, merge.
This lands the spec `plan-2026-08-28-sync-convergence-and-stability.md` into `active/`
so its 31 beads stop reading as dangling, and it delivers the instrument Phase 1 needs.

Then one human step, because the data is private: run
`tbd --dry-run integration sync --explain` on the mirror from #265 and record the field
it names on `tbd-u9eg`. The expected answer is `slot`, on pairs whose Linear column is a
refinement (“In Review”, “Draft”) or whose state type is ambiguous on the team;
`tbd integration setup` prints the ambiguous types (`integration.ts:261-269`), and a
`--verbose --json` dry run shows whether the same ids carry a `slot` patch in `pushed`
on one run and appear in `pulled` on the next.
If the field is instead a known never-round-trips path (a label the adapter drops,
`tbd-vpje`; an assignee with no `user_map` entry), Phase 1a’s exclusion rule ends the
loop; if it is something else, that is a new bead with a reproduction.

### Phase 1: Tracker convergence and an honest umbrella sync

**1a. Convergence contract.** A run’s report partitions every selected item into exactly
one of:

| Class | Meaning | Examples |
| --- | --- | --- |
| actionable | this run will (or, dry-run, would) perform it | push, pull, create, import, comment |
| suppressed | outbound work an inbound-only run will not perform | `suppressedPushes` (exists since `tbd-r1a3`) |
| excluded | a standing condition this run cannot change | past `max_nesting`; a field push the provider or `user_map` cannot carry; `importable` items under `inbound.mode: report` |
| failed | attempted and failed this run | schema refusal, provider error |
| blocked | the whole run was refused before any item | bulk threshold |

`nothingToDo` is true when actionable, suppressed, and failed are all empty.
Excluded items are reported on every run and never count as pending.
This supersedes the reasoning in the 2026-08-28 plan that “a field the run could not
publish is something to do”: a condition the operator resolves by config or
restructuring is a warning, and convergence means the sync has nothing *it* can do while
the warning stays visible.
Code: remove `skippedOutbound` and capability-limited `skippedPushes` from both
`nothingToDo` terms (`sync-engine.ts:1076`, `:1689`), classifying a skipped push as
excluded when its cause is a missing capability and as failed otherwise.

**1b. One report renderer.** Replace the three printers with one function that renders a
`SyncRunReport` and takes the verb tense (`would `) and the invoking command name.
The fold in `tbd sync` (`sync.ts:353-394`) calls it, so a session-end sync shows the
same line as `tbd integration sync`:

```
linear: push 3, pull 1, create 2 | excluded 6 (past max_nesting 2) | failed 1
  excluded: tbd-aaaa, tbd-bbbb, … (6): nested 3 levels, past max_nesting 2;
    re-parent, raise policy.outbound.max_nesting, or set policy.outbound.deep: flatten
  failed: tbd-cccc: duplicate_of is only valid with resolution: duplicate
```

`excluded` and `failed` never take `would`. Detail lines print at default verbosity,
capped at ten per class with `--verbose` for all.
`nothing to do` prints when the contract says so, followed by the excluded line if any.
The fold’s own commit is tallied into the git summary, so `Already in sync` cannot
follow a fold that wrote.

**1c. A blocked or failing run says what is behind it.** Hoist `reports` above the `try`
in the fold (`sync.ts:1231`). Make the bulk guard’s refusal a typed error carrying the
planned counts (it already has them at `sync-engine.ts:1015-1017`), so the fold prints:

```
linear: blocked by the bulk threshold: 174 updates (limit 40); pending push 174, pull 1
  Run `tbd sync --yes`, or narrow with `tbd integration sync --bead <id>` / `--limit <n>`
```

When items fail, the summary still prints the counts for what ran and lists every
failure, not the first plus “N more”.
The remedy text names the command that was actually invoked: `bulk-guard.ts:52-58` takes
the command name as a parameter.

**1d. `tbd sync --yes`.** Sets `assumeYes: true` for the tracker fold regardless of the
`on_tbd_sync` posture, except `off`. `report` mode stays a dry run; `--yes` under
`report` is an error naming the config key.

**1e. `max_nesting` is visible where the depth is set, in doctor, and in the skip.**

- `tbd create --parent` and `tbd update --parent` (single and bulk) print a notice after
  the write when a provider is enabled, the bead is in that provider’s outbound
  selection, and its depth within the selection (`depthWithinSelection`,
  `mirror.ts:91-111`) exceeds `maxNesting`:
  `tbd-xxxx is 3 levels deep; linear mirrors new issues to max_nesting 2, so it stays excluded from the tracker until re-parented or the policy changes.`
  The selection is computed once from the issues `update` already loads for the cycle
  check.
- A doctor check, **Tracker nesting**, lists the beads currently excluded per enabled
  provider, offline, `warn` status, with the same remedy.
  It follows the `checkStateResolution` precedent (`doctor.ts:924`) of an offline check
  over bead fields and config.
- The skip reason in both sites (`mirror.ts:236`, `sync-engine.ts:900`) names the
  remedy, from one shared template.
- The engine’s private fallback `options.maxNesting ?? 2` (`sync-engine.ts:580`) becomes
  a required option, so a future call site cannot silently reintroduce the defect fixed
  at `integration-runner.ts:567-573`.

**1f. Opt-in flattening.** `policy.outbound.deep: skip | flatten`, default `skip`. Under
`flatten`, a bead past `max_nesting` is mirrored as a top-level tracker issue with
`Parent: <display id> <title>` in the managed block, and its provider parent is left
unset. Already-linked deep beads are mirrored exactly this way today
(`mirror.ts:240-272`), so `flatten` generalizes existing behavior rather than inventing
one. The 2026-08-10 spec chose “deeper structure stays in beads” because Linear’s views
flatten past two levels; that stays the default, and `flatten` is for a team that would
rather see a flat epic than none.
See Open Questions.

**1g. Duplicate close survives the round trip**
([#267](https://github.com/jlevy/tbd/issues/267)). `BeadPatch` gains `duplicate_of`. One
function, `applyTerminalAxis(stored, patch)`, applies `status`, `resolution`, and
`duplicate_of` together and maintains the invariant the write boundary enforces;
`sync-engine.ts:1383-1398` and every future patch site call it.
Rules: when the patch sets a resolution other than `duplicate`, or reopens, it clears
`duplicate_of` (as `reopen.ts:139-144` does); when the inbound state is `duplicate` and
the stored bead already carries `resolution: duplicate` with a pointer, the pair is kept
and the downgrade to `canceled` (`sync-engine.ts:806-810`) applies only to a bead with
no pointer. The outbound half, creating the provider-side duplicate relation from the
scalar, is marked done in the state-model spec (`:478-479`) but has no implementation
(`CanonicalPatch` carries no `duplicate_of`, `types.ts:102-103`; the adapter has no
`duplicateIssueId`); that checkbox and the inbound one at `:480-481` are corrected and
the outbound work is filed under that spec as `tbd-vp4p`.

**1h. A refinement the bead cannot express is remote-owned.** Two rules end the
alternation described in root cause 4:

- In the matrix, when the remote slot and the local slot are in the same band and the
  local side cannot express the remote’s refinement, the slots agree; the bead is
  written only when the band changes.
  The pull still records the refinement on the link record (`refinement_slot`,
  `refinement_state_id`) so the replay at `sync-engine.ts:795-801` can return the issue
  to its column after it leaves and comes back, which is the behavior that test already
  pins.
- In the adapter, a state the team cannot resolve is a skipped field push with a reason
  (`no unambiguous started state on team OS: In Dev, In Review`), never a silent
  success. That skip is `excluded` under 1a, so it is visible on the first run and does
  not hold convergence.

A regression test extends the “column a person moved it to” case to a third run, after
the link record carries an exact slot, and a slots test round-trips every slot without
passing the refinement back in (today `tests/slots.test.ts:105-118` passes it, which
production never does).

**1i. Pulled prose keeps its `## Notes` heading.** The parser’s notes split
(`parser.ts:74-83`) applies to beads tbd wrote; a pulled description is stored so that a
literal `## Notes` in tracker prose round-trips unchanged.

### Phase 2: Spec lifecycle

**Principle.** A stored `spec_path` is the spec’s *last known location*; the spec’s
*identity* is its basename.
That is what the read side already does, and Phase 2 makes the rest of tbd agree.

**2a. One resolver.** `resolveSpecLocation(storedPath)` in `lib/spec-lifecycle.ts`
classifies a stored path as one of:

| Class | Condition |
| --- | --- |
| `present` | the file exists at that path in the working tree |
| `moved` | not present, and exactly one file with that basename exists elsewhere under the specs directory |
| `ambiguous` | not present, and several such files exist |
| `on-branch` | not present, and `git ls-tree` finds it on one or more local or remote branches |
| `missing` | none of the above |

Doctor, `tbd spec status`, `list --specs`, write-time validation, and `spec move` all
call this one function, so they cannot disagree.
The specs directory is `specs.dir` in `.tbd/config.yml`, default `docs/project/specs`;
the lifecycle folder is the first path segment beneath it.
The git lookup reuses the `ls-tree` form in `permalink.ts:82-90` over
`git for-each-ref refs/heads refs/remotes`, bounded and cached per run.
`resolveSpecArg`’s write-time basename search under `docs/` is unchanged.

**2b. Three doctor checks, one group.** Following the `checkForkedDocs` group convention
(`doctor.ts:2405`, zero findings when nothing is wrong), a **Spec links** group reports:

- **Dangling spec links**: beads whose path is `moved` (fixable: `--fix` repoints them,
  one write each under the shared lock, open and closed alike, with counts for both),
  `ambiguous` (listed with candidates), `missing` (listed; suggestion names
  `tbd update <ids…> --spec ""` and `tbd spec status`), and `on-branch` (an `ok` line
  naming the branch, not a defect).
- **Epics without a spec**: open epics with no `spec_path`, listed, with the bulk form
  as the suggestion.
- **Duplicate spec filenames**: one basename in two lifecycle folders, listing both
  paths and the bead count on each.

The classifier is a pure exported function unit-tested without a repository, per the
existing doctor convention (`classifyNpmGlobalBin`, `clearableLockSidecars`).

**2c. `tbd spec status`.** One row per spec file under the specs directory, plus one row
per path that beads reference but that is not a file:

```
FOLDER   SPEC                                              OPEN  CLOSED  EPICS  TODO  STATE
active   plan-2026-08-14-external-sync-and-traceability.md   22      36      1    26  ok
active   plan-2026-02-16-kdex-knowledge-index-cli.md          0       0      0     9  no beads
done     plan-2026-01-27-inherit-spec-path.md                 0       8      1     0  all closed
active   plan-2026-08-28-sync-convergence-and-stability.md   25       6      1     ?  on branch claude/tbd-sync-bugs-review-f1qb1f
(none)   docs/project/specs/active/plan-2026-05-01-old.md    3       0      0     -  moved → done/plan-2026-05-01-old.md
```

`TODO` is the unchecked-checkbox count.
`--json` emits the same rows.
`--dir` overrides the specs directory; `--folder active` filters.
This is the triage table the `update-specs-status` shortcut currently tells agents to
build by hand.

**2d. `tbd spec move <old> <new>`.** In one command, under `--dry-run` first:

1. `git mv` the file (refusing if the source is not tracked or the destination exists).
2. Rewrite inbound Markdown links across tracked `.md` files: any link whose resolved
   target is the old file, in all three shapes the reporter measured
   ([#274](https://github.com/jlevy/tbd/issues/274)): the `specs/<folder>/<file>`
   fragment under any prefix, and bare or `./` sibling links resolved relative to the
   linking file. Prose mentions are not touched.
   The rewrite reports each file and count.
3. Repoint every bead whose `spec_path` names the old path, as one bulk write under one
   lock, with the sync hint the bulk mutators print.

The command is a thin composition of the resolver, the bulk `--spec` path from Phase 3,
and a link rewriter in `lib/markdown-links.ts` that is unit-tested on fixtures.

**2e. Write-time validation accepts a spec on another branch**
([#273](https://github.com/jlevy/tbd/issues/273)). `resolveSpecArg` falls through, when
the literal path is not in the checkout, to the resolver’s git lookup; an `on-branch`
result is accepted with a notice naming the branch.
`--no-verify` on `create` and `update` skips existence checks (the path is still
normalized and must be inside the project), for a spec that exists uncommitted in
another worktree. No ref is persisted: branches merge, and a stored ref would go stale
the way the path does today.
Doctor and `spec status` compute “on branch” at read time.

**2f. `list --specs` markers.** A group header for a non-present path carries the
resolver’s class (`(moved → done/…)`, `(on branch x)`, `(missing)`), and
`--specs --json` emits groups instead of silently flattening.

### Phase 3: Bulk contract and hierarchy views

**3a. Bulk `--parent` and `--spec`.** The rule, stated in the refusal message and the
design doc from one table: a flag is bulk-eligible when one value applies to every ID.
Per-ID-only flags remain `--title`, `--description`, `--notes`, `--notes-file`,
`--from-file`, and `--child-order`; `--status` stays with `close` and `reopen`.

Bulk `--parent` is validate-all-then-apply: resolve the parent once; for every ID run
`checkParentAssignment` against the graph *as it will be after all moves*, so the parent
may not be any of the IDs or a descendant of any of them and no result exceeds
`MAX_PARENT_DEPTH`; abort before writing if any check fails.
Apply per issue: set `parent_id`, inherit the parent’s spec when the child has none and
`--spec` is absent, append to the new parent’s hints once, and remove the child from
each old parent’s hints.
Bulk `--spec` sets the path and propagates to children by the single-issue rule
(`update.ts:257-274`).

The hint append and the new removal move to `lib/child-order.ts`, called from `create`,
`update` (both paths), `spec move`, and `integration-runner.ts:623`.

**3b. `tbd list --children`.** Adds `children: { total, open, closed }` to each JSON row
and a `CHILDREN` column (`open/total`) to text.
Counts use `parent_id`, never hints, over all issues including closed, while the rows
themselves stay filtered as before.
`tbd list --type epic --children` is the epic view
([#270](https://github.com/jlevy/tbd/issues/270)).

**3c. `--linked [provider]` and `--unlinked [provider]`.** Filter on the provider link
(`readLink`). With one enabled provider the argument is optional; with several and none
named, the error lists them.
JSON rows gain `links: { <provider>: { id, linked_at } }` only when a link exists, so
the pinned shape for unlinked beads (`tests/cli-id-format.tryscript.md:87-120`) is
unchanged.

**3d. Id spaces.** `parentId` (display) and `child_order_hints` (internal) stay as they
are; `internalId` is documented as the join key, and `--children` removes the need to
join. See Open Questions for the alternative.

### Phase 4: Environment safety

Implements the two beads that already exist for this (`tbd-pjan` under the 2026-08-28
plan, `tbd-fnwc` under the 2026-08-14 plan) and adds the cheap observability half.

**4a. Resolution stops at the git boundary.** `findTbdRoot` walks up from cwd but not
past the git worktree root of cwd.
Inside a git repository whose nearest `.tbd/config.yml` lies above that root, the error
names both paths and exits 2. Outside any git repository, tbd already refuses (it
requires one), and the message says so rather than adopting a stray `~/.tbd/`.

**4b. Prefix validation at the chokepoint.** `resolveIssueId` compares the parsed prefix
(`extractPrefix`, `ids.ts:196`) against the repository’s and errors naming both; the
`bd-` compatibility prefix (`ids.ts:219`) stays accepted.

**4c. `tbd status` prints the resolved root** under `Repository:`, as doctor does, and
`status --json` and `doctor --json` carry `repo_root` and `id_prefix`. `tbd -C <path>`
and identity in every `--json` payload are follow-on beads `tbd-ziie` and `tbd-uev6`.

**4d. The session hook.** All three generated scripts append fallback locations instead
of prepending (`setup.ts:304`, `:426`, `ensure-gh-cli.sh:31`). The readiness probe
checks the Node major before invoking tbd and returns a distinct status, so the hook
prints “requires Node.js 22.12.0” for a runtime failure and the format message only for
a format failure. When the failure is a runtime failure the `npx` fallback is skipped
with a line saying why, since it runs under the same Node.
Every failure path emits a `systemMessage` so a broken hook is visible in the session
rather than in a debug log.
`tbd-qd1n` (doctor executes the installed hook scripts with a probe input) lands with
it, because it is the check that would have caught this class.

### Phase 5: Agent surfaces

**5a. `update-specs-status` uses the tool**
([#274](https://github.com/jlevy/tbd/issues/274)). Step 2’s triage input becomes
`tbd spec status --json` and `tbd list --type epic --children --json`; the link-rewrite
passage (`update-specs-status.md:154-161`) becomes “use `tbd spec move`, which rewrites
the fragment form and bare or `./` sibling links, then confirm with `tbd spec status`”;
the read-the-bead-files instruction (`:233-238`) and the id-space warning (`:239-243`)
are removed; the “missing from disk” row (`:64`) becomes the `on branch` state.
A test reads the shortcut and asserts it names no path under the data-sync worktree and
that every `tbd …` command it mentions parses (`tbd <cmd> --help` exits 0), following
`tests/watch-beads-shortcut.test.ts`.

**5b. The closing reminder fires on `gh pr create`**
([#179](https://github.com/jlevy/tbd/issues/179),
[#180](https://github.com/jlevy/tbd/issues/180)). The one script template
(`TBD_CLOSE_PROTOCOL_SCRIPT`, `setup.ts:405-420`) matches `gh pr create` and
`gh pr ready` alongside `git push`, recovers the PR number from the tool response when
present, and defers to `tbd closing`. Both the Claude and Codex surfaces are generated
from that template, so it propagates by construction.
#180’s upsert-by-identity already exists (`setup.ts:986-993`, `:1200-1212`); the
remaining ask, a `--dry-run` diff of hook changes, is a follow-on bead.

**5c. Forked-shortcut customization** ([#181](https://github.com/jlevy/tbd/issues/181)).
`new-shortcut.md` and the Managing Docs section of `tbd-docs.md` gain the six-step
existing-shortcut workflow and distinguish forked managed docs from project-only
shortcuts. `tbd setup --auto` regenerates `docs/tbd/README.md` when forks exist (today
only `docs fork` does, `docs-fork.ts:190`) and ends with
`Setup finished with N warning(s)` and exit 1 when a generated file could not be
written, instead of `All set!` (`setup.ts:1679`).

**5d. Close what is already fixed.** #238 (`skill-baseline.md:148`, and bead
`tbd-a0sl`), #255 (`ensure-gh-cli.sh:264-270`, `skill-baseline.md:180`; the optional
doctor channel model is not planned, because the egress test belongs in the session hook
that already runs it), and #195 (decision rule at `setup-github-cli.md:192`;
`setup --auto` rewrites `ensure-gh-cli.sh` on every run, `setup.ts:1021`) are closed
with comments citing those lines.

**5e. Docs.** `tbd-design.md` lists `--spec`, `--specs`, `--children`, `--linked` under
List and the generated bulk-eligible set under Update (`:2999-3023` today);
`tbd-docs.md` documents `tbd spec`, the doctor group, `--children`, `--linked`,
`sync --yes`, and the exclusion vocabulary; `skill-baseline.md` routes “where do things
stand on the specs?”
to `tbd spec status`; the CHANGELOG entry leads with convergence and the spec lifecycle.

## API Changes

| Surface | Change |
| --- | --- |
| `tbd sync` | `--yes` |
| `tbd integration sync` | report vocabulary: `excluded`, `failed`, `blocked`; `policy.outbound.deep: skip \| flatten` |
| `tbd create`, `tbd update` | notice when the new depth exceeds an enabled provider’s `max_nesting`; `--no-verify` for `--spec` |
| `tbd update <ids…>` | `--parent` and `--spec` accepted in bulk |
| `tbd list` | `--children`; `--linked [provider]`, `--unlinked [provider]`; JSON `children` and `links`; `--specs --json` groups; markers on `--specs` headers |
| `tbd spec` | new group: `status [--json] [--dir] [--folder]`, `move <old> <new> [--dry-run]` |
| `tbd doctor` | groups **Spec links** and **Tracker nesting**; `--fix` repoints moved specs |
| `tbd status` | resolved root; `--json` carries `repo_root`, `id_prefix` |
| `.tbd/config.yml` | `specs.dir` (default `docs/project/specs`); `integrations.<p>.policy.outbound.deep` |
| Generated hooks | PATH append; Node probe; `systemMessage` on failure; closing reminder on `gh pr create` |

No bead schema change and no format bump: `BeadPatch` is an in-memory type, and the two
config keys are optional with defaults resolved in code, following the f08 convention
(`provider-settings.ts:93-99`).

## Implementation Plan

Each phase is one PR. Phases 1 through 5 are independent of each other except where
noted; Phase 5a depends on 2c, 2d, and 3b.

### Phase 0: Land the stability branch

- [ ] `tbd-bdkj` — rebase `claude/tbd-sync-bugs-review-f1qb1f` onto `main`, run the
  integration suites and `cli-sync*` tryscripts, open and merge the PR
- [ ] `tbd-xn8m` — run `--explain` on the #265 mirror and record the named field on
  `tbd-u9eg` (human step; private data)

### Phase 1: Tracker convergence and an honest umbrella sync

- [ ] `tbd-km3p` — convergence contract: exclusions never hold `nothingToDo` false
  (red-green: a second run over an unchanged deep bead reports nothing to do)
- [ ] `tbd-020a` — one report renderer for `tbd sync` and `tbd integration sync`, with
  `excluded` / `failed` / `blocked` vocabulary and capped detail lines
- [ ] `tbd-nho2` — blocked and failing runs print pending counts and every failure;
  typed bulk-threshold error; remedy names the invoked command
- [ ] `tbd-ub5a` — `tbd sync --yes`
- [ ] `tbd-jd6m` — `max_nesting` notice at `create`/`update --parent`, the **Tracker
  nesting** doctor check, the shared skip template, and the required `maxNesting` option
- [ ] `tbd-4c5c` — `policy.outbound.deep: flatten` (pending the open question)
- [ ] `tbd-alws` — `applyTerminalAxis` and `BeadPatch.duplicate_of`; e2e: close as
  duplicate, reopen remotely, sync succeeds and clears the pointer; correct the two
  state-model checkboxes and file the outbound relation bead
- [ ] `tbd-od0z` — same-band refinement agreement in the matrix; unresolvable state is a
  skipped push, never a silent success; third-run regression test
- [ ] `tbd-f99c` — the fold’s commit counts in the git summary (no `Already in sync`
  after a fold that wrote)
- [ ] `tbd-w1kd` — a pulled description with a `## Notes` heading round-trips unchanged

### Phase 2: Spec lifecycle

- [ ] `tbd-2owj` — `resolveSpecLocation` and `specs.dir`, with the git lookup
- [ ] `tbd-2u0q` — the **Spec links** doctor group with `--fix` for moved paths
- [ ] `tbd-0f7g` — `tbd spec status`
- [ ] `tbd-mfp1` — `tbd spec move` and the Markdown link rewriter
- [ ] `tbd-1f1v` — write-time validation accepts `on-branch`; `--no-verify`
- [ ] `tbd-l9wg` — `list --specs` markers and `--specs --json` groups

### Phase 3: Bulk contract and hierarchy views

- [ ] `tbd-7us9` — bulk `--parent` and `--spec`, set-wide cycle check,
  `lib/child-order.ts` with old-parent removal, generated eligibility list
- [ ] `tbd-5oi0` — `list --children`
- [ ] `tbd-stv3` — `--linked` / `--unlinked` and JSON `links`

### Phase 4: Environment safety

- [ ] `tbd-pjan` — git-boundary resolution and prefix validation (existing bead)
- [ ] `tbd-vnbl` — `tbd status` resolved root; `repo_root` and `id_prefix` in
  `status --json` and `doctor --json`; follow-on beads for `tbd -C` and JSON identity
- [ ] `tbd-fnwc` — hook PATH order, Node probe, skipped fallback, `systemMessage`
  (existing bead)
- [ ] `tbd-qd1n` — doctor executes installed hook scripts (existing bead)

### Phase 5: Agent surfaces

- [ ] `tbd-0ia9` — rewrite `update-specs-status` and pin it with a test
- [ ] `tbd-adgq` — closing reminder on `gh pr create` and `gh pr ready`
- [ ] `tbd-po91` — forked-shortcut customization docs; README index regeneration in
  `setup --auto`; honest setup exit
- [ ] `tbd-hspp` — close #238, #255, #195 and bead `tbd-a0sl` with citations
- [ ] `tbd-owf9` — design doc, CLI manual, skill baseline, CHANGELOG

## Testing Strategy

Every behavioral change is red-green, and the goldens that pin current output are
updated deliberately rather than discovered:

- **Convergence** (Phase 1): in `tests/integrations-sync-engine.test.ts`, beside the
  nesting test at `:693`, a second `runSync` over an unchanged deep bead must report
  `nothingToDo: true` and list the bead as excluded.
  A property over the existing engine tests asserts dry-run and execute agree on every
  class count.
- **Umbrella output** (Phase 1): an e2e in the shape of
  `tests/integration-nesting-config.e2e.test.ts` asserts the `tbd sync` tracker line,
  the blocked-by-threshold line with pending counts (no test exercises the “large
  change” message through the CLI today), and that `tbd sync --yes` proceeds.
- **Duplicate close** (Phase 1): e2e, because the engine unit tests’ `writeBead` is a
  `Map.set` that never runs `IssueSchema.parse`; seed with
  `tbd close <id> --as duplicate --duplicate-of <other>`, have the mock return a
  non-duplicate state, assert the sync succeeds and the pointer is cleared.
- **Spec resolver and doctor** (Phase 2): pure unit tests over a fixture tree for all
  five classes; an e2e for `--fix` and for the zero-findings silence; the pinned doctor
  output in `tests/cli-orientation-golden.tryscript.md:74-146` gains the new lines.
- **`spec move`** (Phase 2): a fixture repository with all three link shapes, including
  a bare sibling link that must be rewritten and a same-basename link in another folder
  that must not; assert file, link, and bead outcomes and the `--dry-run` preview.
- **Bulk `--parent`** (Phase 3): tryscript cases for a set containing the proposed
  parent, a set containing an ancestor of the parent, and a legal move; assert no write
  on refusal, and that the old parent’s hints no longer carry the child (the gap
  `tests/child-order-e2e.test.ts` leaves today).
- **`--children` and `--linked`**: `tests/cli-list-specs.tryscript.md` and
  `tests/specs-flag.test.ts` extended; a linked bead in the mock-server e2e.
- **Environment** (Phase 4): a nested-repository fixture for the boundary error; a
  prefix-mismatch tryscript; a hook test with two Node binaries on `PATH` asserting the
  chosen runtime and the message.
- **Shortcut** (Phase 5): the text test described in 5a.

## Rollout Plan

Phases 0 through 3 ship together as the next minor release (`0.9.0`: new CLI
capability), since `tbd spec` and `--children` are new surfaces and the convergence
change alters what `nothing to do` means.
Phases 4 and 5 can ride in the same release or the following patch.
Release notes lead with: mirrors that never settled will settle, a previously silent
`tbd sync` prints a tracker line and names what blocks it, and spec links survive moves.

Repositories upgrading with dangling spec links see the new doctor findings on first
run; `tbd doctor --fix` repairs the mechanical case and lists the rest.

## Open Questions

- **Flatten deep epics, or keep them out of the tracker?** Recommendation: implement
  `policy.outbound.deep: flatten` as opt-in (1f). It is cheap because linked deep beads
  already mirror parentless, and a team that wants visibility over hierarchy should be
  able to choose it. If declined, 1e still ends the silence.
- **Convert `child_order_hints` in `list --json` to display ids?** Recommendation: no.
  The key is pinned by goldens and consumers, `internalId` is present on every row, and
  `--children` removes the join.
  Revisit if a consumer other than the shortcut appears.
- **`--no-verify` versus `--spec-ref <branch>`** for a spec on another branch.
  Recommendation: the automatic git lookup plus `--no-verify`, since a stored ref goes
  stale and the branch is only informational.
- **Should `--fix` for moved spec links rewrite closed beads?** Recommendation: yes, all
  of them; `list --all --spec` and `spec status` count closed beads, and the write is
  under `--fix`. The finding reports open and closed counts separately so the operator
  sees the volume first.
- **Should excluded field pushes stay excluded when `user_map` later gains the entry?**
  They do by construction: the class is recomputed every run, so the field becomes
  actionable the run after the config changes.

## References

- Issues: [#265](https://github.com/jlevy/tbd/issues/265),
  [#267](https://github.com/jlevy/tbd/issues/267),
  [#269](https://github.com/jlevy/tbd/issues/269) through
  [#276](https://github.com/jlevy/tbd/issues/276),
  [#204](https://github.com/jlevy/tbd/issues/204),
  [#254](https://github.com/jlevy/tbd/issues/254),
  [#179](https://github.com/jlevy/tbd/issues/179),
  [#180](https://github.com/jlevy/tbd/issues/180),
  [#181](https://github.com/jlevy/tbd/issues/181)
- `plan-2026-08-28-sync-convergence-and-stability.md` (on
  `claude/tbd-sync-bugs-review-f1qb1f` until Phase 0): the convergence work this plan
  extends
- `plan-2026-08-14-external-sync-and-traceability.md`: `tbd-fnwc`, `tbd-42u4`,
  `tbd-qd1n`, `tbd-u25v`
- `plan-2026-08-18-tracker-state-model-and-linear-mapping.md`: the terminal axis; two
  checkboxes corrected by 1g
- `plan-2026-06-13-agent-cli-ergonomics.md`: the bulk contract this plan extends
- `packages/tbd/docs/references/linear-integration-design.md`: read before changing sync
  behavior
- `tbd shortcut update-specs-status`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
