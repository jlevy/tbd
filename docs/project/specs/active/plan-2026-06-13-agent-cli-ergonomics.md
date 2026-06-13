---
title: "Agent CLI Ergonomics: Bulk Ops, Output Contract, and Sync Clarity"
description: Reduce agent bash contortions (for-loops over issues, output truncation, sync rituals) by adding bulk/multi-target verbs, a trustworthy output contract, and a clear sync model
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Agent CLI Ergonomics (Bulk Ops, Output Contract, Sync Clarity)

**Date:** 2026-06-13 (last updated 2026-06-13)

**Author:** Joshua Levy

**Status:** Draft

> **Revised 2026-06-13 after a senior engineering review on
> [PR #176](https://github.com/jlevy/tbd/pull/176).** Phase 1 was tightened: `--sync`
> gets a tri-state intent and an explicit lock boundary, the unsynced hint must be
> visible (via `output.notice()`, not the verbose-only `output.info()`), single-ID
> `close`/`reopen` behavior is preserved (skips are bulk-only), bulk `show` is split out
> as a separate read-only design, and `update --status closed` is excluded from bulk
> closure. Sync doc fixes extend to `tbd-design.md`.

## Overview

Agents drive tbd through bash, and when a task touches more than one issue they fall
back to error-prone shell contortions: `for` loops over issue IDs, `2>&1 | tail -1` on
every command to tame output, `echo "=== ... ==="` headers to hand-roll a progress
display, and a `--no-sync ... ; tbd sync` ritual to manage syncing.
These patterns are brittle, hide what happened from the user, and make multi-issue work
the most failure-prone thing an agent does with tbd.

This spec catalogs the common problems, then proposes a **layered** fix that front-loads
backward-compatible **quick wins** suitable for the current release (multi-target verbs,
a trustworthy output contract, and an honest sync model) and maps out **broader ideas**
(query-driven mutation, a transaction-file `apply` command) as follow-on work.

It is a product/runtime change to tbd’s own CLI. It is distinct from
[plan-2026-06-03-tbd-agent-cli-guideline-improvements.md](plan-2026-06-03-tbd-agent-cli-guideline-improvements.md),
which improves the *guideline* about writing agent skills; this spec changes how tbd’s
issue commands actually behave.

### Motivating example

A real agent command observed in the field (tbd-relevant slice; git/gh plumbing elided):

```bash
for b in fin-iri4 fin-kq1k fin-c02g; do
  tbd close $b --reason "Delivered via PR #78 ..." --no-sync --quiet 2>&1 | tail -1
done
tbd close fin-xgo2 --reason "Keystone delivered via PR #78 ..." --no-sync --quiet 2>&1 | tail -1
tbd create "KNOWN_DESCRIPTORS completeness gate ..." -t task -p 3 --parent fin-g1gv \
  --no-sync --quiet -d '...long multi-paragraph body with $vars and `backticks`...' 2>&1 | tail -1
tbd create "Reconcile fintool-server SEC mock shape ..." -t task -p 3 --parent fin-g1gv \
  --no-sync --quiet -d '...' 2>&1 | tail -1
tbd sync --quiet 2>&1 | tail -1
```

Every awkward thing here maps to a missing tbd primitive (see Problem Catalog).
After Phase 1 the close loop collapses to a single call:

```bash
# one call, one lock, one summary line, one push:
tbd close fin-iri4 fin-kq1k fin-c02g fin-xgo2 \
  --reason "Delivered via PR #78 (merged to integration/launch 2026-06-13)" --sync
```

## Goals

- **Eliminate the bash `for` loop** over issue IDs for the common verbs by accepting
  multiple targets natively, under one lock, with one summary.
- **Make output trustworthy** so agents stop wrapping commands in `2>&1 | tail -1`: a
  documented single-line success contract, a stable `--json` shape, and incidental
  notices that `--quiet` reliably silences.
- **Make the sync model honest and self-revealing** so the `--no-sync ... ; tbd sync`
  ritual is unnecessary: tell the agent when changes are unsynced, and let a bulk write
  publish once on request.
- **Remove the shell-quoting hazard** for large text fields (reasons, descriptions,
  notes) by supporting file and stdin bodies consistently across verbs.
- **Prioritize backward-compatible quick wins** that can ship in the current release,
  and map the larger ideas without committing to them yet.
- **Establish a consistent verb spine** (`verb [ids...] --flags`) future commands
  inherit.

## Non-Goals

- Owning git/gh plumbing (PR merge, worktree/branch cleanup).
  tbd will not wrap these; only the issue-tracking half of the motivating example is in
  scope.
- A general query/expression language beyond what `list` already understands.
  Phase 2 reuses the existing filter grammar; it does not invent a new one.
- Changing the on-disk issue format or the sync-worktree storage model.
- Interactive TUI work.
  The output contract targets piped/non-TTY agent use first.

## Background

Findings from the current code (cited so the plan is grounded, not speculative):

- The core mutators each take exactly one ID:
  [`close.ts:88`](../../../../packages/tbd/src/cli/commands/close.ts),
  [`update.ts:431`](../../../../packages/tbd/src/cli/commands/update.ts),
  [`reopen.ts:91`](../../../../packages/tbd/src/cli/commands/reopen.ts), and
  `show.ts:194` all declare `.argument('<id>')`.
- The repo already uses variadic args idiomatically elsewhere: `label.ts:201`
  (`<labels...>`) and `docs-fork.ts:762` (`[names...]`). The mutators are inconsistent,
  not idiomatically blocked.
- Argument conventions are uneven: `label add <id> <labels...>` is variadic on the
  *label* axis (one issue, many labels), `dep add <issue> <depends-on>` is pairwise,
  `docs fork [names...]` is variadic, and the issue mutators are single.
  There is no shared `verb [ids...] --flags` spine.
- `success()` already prints exactly one line
  ([`output.ts:382`](../../../../packages/tbd/src/cli/lib/output.ts)), but two stderr
  notices can interleave with it: worktree auto-heal
  ([`data-context.ts:183`](../../../../packages/tbd/src/cli/lib/data-context.ts)) and
  config migration (`data-context.ts:164`).
- **`--no-sync` is effectively a no-op for issue writes.** The `sync` boolean is set in
  [`context.ts:46`](../../../../packages/tbd/src/cli/lib/context.ts) but read by no
  mutator; `auto_sync` has no issue-level consumer in `src/` (only the docs cache honors
  `doc_auto_sync_hours`). Writes stage into the hidden sync worktree and are published
  only by `tbd sync`.
- The right shape already exists in one place: `import` ingests many issues under a
  single lock, prints one summary line, and nudges *“Run `tbd sync` to commit and push
  imported issues”*
  ([`import.ts:293`](../../../../packages/tbd/src/cli/commands/import.ts)). The mutators
  should adopt the same shape.

## Problem Catalog

The common problems agents hit, each with the bash symptom it produces:

1. **P1: Single-target mutators force shell loops.** `close`/`reopen`/`update`/`show`
   take one `<id>`, so N issues become `for b in ...; do tbd close $b ...; done`. Each
   iteration re-acquires the repo lock and re-resolves the worktree (N times the work),
   and a mid-loop failure leaves a partially-applied change with no transaction
   boundary.

2. **P2: No query-driven mutation (no select-and-act).** There is no way to express
   “close all open children of X” or “label everything matching Y” without first
   listing, parsing IDs out of text/JSON, and looping.
   The read side has filters (`list`, `ready`, `blocked`, `stale`, `search`); the write
   side cannot consume them.

3. **P3: Output is not trusted, so agents truncate it.** Despite the single-line
   `success()`, agents defensively pipe `2>&1 | tail -1` because they cannot be sure how
   many lines a command emits, stderr notices interleave with stdout, and in a loop they
   only want the final line.
   `tail -1` then swallows real errors, hiding failures.

4. **P4: No structured, user-visible record of a multi-step session.** The agent
   hand-rolls a UI with `echo "=== ... ==="` because tbd surfaces nothing to the user.
   A multi-issue tbd session is invisible unless the agent narrates it, and there is no
   machine- and human-readable “here is the batch I just applied” summary.

5. **P5: The sync model is murky and partly vestigial.** `--no-sync` is consumed by no
   mutator and `auto_sync` is not wired for issues, yet both *imply* a per-command sync.
   Agents cargo-cult `--no-sync` on each write and append a final `tbd sync`, getting
   the right outcome by accident.
   Nothing tells the agent “you have N unsynced changes.”

6. **P6: Large text fields inline in the shell are a quoting and correctness hazard.**
   Multi-paragraph `--reason "..."` / `-d '...'` strings containing `$`, backticks,
   quotes, or `#` are pasted straight into bash, risking interpolation, truncation, or
   command injection, and are not reviewable.
   `create` already supports `--file`/`-f` and `update` supports `--notes-file`, but
   `close --reason` has no file form and there is no batch equivalent or shared stdin
   (`-`) convention.

7. **P7: Inconsistent argument conventions.** Without a `verb [ids...] --flags` spine,
   agents cannot generalize muscle memory across verbs and reach for bash instead (see
   Background for the specific inconsistencies).

8. **P8: No preview/confirm discipline for set-based writes.** `--dry-run` exists
   globally but there is no “show the N items this would touch, then apply” affordance,
   which is exactly what makes query-driven mutation (P2) safe to offer.

9. **P9 (adjacent, broader): “delivered by PR #N” has no first-class expression.** The
   recurring intent “close these as delivered via PR #78” always degrades into bespoke
   bash and an unstructured reason string, so the provenance is not queryable later.
   Out of tbd’s direct control for the git half, but the bead half could be first-class.

## Design

### Approach

Layer the work so value lands early and risk stays low:

- **Phase 1 (quick wins, current release):** purely additive, backward-compatible
  changes to existing verbs.
  Multi-target IDs, a bulk summary + accurate sync hint, file/stdin bodies for reasons,
  and an honest sync contract.
  No new top-level commands.
- **Phase 2 (broader, follow-on):** query-driven mutation and a transaction-file `apply`
  command. These are larger surfaces with real blast radius and get their own design
  pass; this spec scopes them enough to file beads, not to build blind.

### Components

CLI command modules under `packages/tbd/src/cli/commands/` (`close.ts`, `reopen.ts`,
`update.ts`, `show.ts`), the shared output layer (`cli/lib/output.ts`), the command
context (`cli/lib/context.ts`), and the data context that owns the lock
(`cli/lib/data-context.ts`). Phase 2 adds a new `apply.ts` that generalizes the existing
`import.ts` ingestion path.

### API Changes (Phase 1, backward-compatible)

- **Variadic IDs (mutators).** Change `close`/`reopen`/`update` from `<id>` to
  `<ids...>` (mutators only; **not** `show`, see below).
  A single ID behaves exactly as today.
  Multiple IDs are processed under one `withDataSyncContext({ lock: true })` pass.
  - `tbd close A B C --reason "..."` applies the shared reason to all.
  - `tbd update A B C --add-label delivered --priority 3` applies shared **field**
    updates to all. Per-ID-only flags (e.g. `--title`) are rejected when more than one ID
    is given. Closing is done via `close`, **not** `update --status closed`: `update`
    assigns `status` only and does not set `closed_at`/`close_reason`, so using it as a
    bulk close would write semantically incomplete issues (PR #176 review).
    Bulk `update` is limited to fields with no lifecycle side effects.
  - **Validation/atomicity (default, fail-closed):** resolve all IDs first; if any is
    unknown, abort before writing anything and list the bad IDs.
    `--ignore-missing` downgrades unknown IDs to skips.
  - **Single-ID behavior is preserved exactly (PR #176 review).** Single-target `close`
    of an already-closed issue stays idempotent (silent success); single-target `reopen`
    of an already-open issue keeps **erroring with exit 1** (locked by
    `cli-crud.tryscript.md`). The “`already-X` is a reported *skip*” rule applies **only
    to bulk paths** (2+ IDs), where the intent is batch completion.
    Every existing single-ID golden stays green.
- **Bulk `show` is a separate, read-only design (PR #176 review), not part of this
  mutator slice.** `show` takes no write lock, emits multi-line YAML/Markdown plus
  optional parent context, and shares none of the summary/hint/`--sync` contract.
  A safe version is `tbd show A B C` rendering each issue with a delimiter and `--json`
  returning an array; it is tracked separately and may land later.
- **Bulk summary + visible sync hint.** A multi-target write prints one deterministic
  summary line (text mode), e.g.
  `Closed 3, skipped 1 (already closed): tbd-a tbd-b tbd-c`. When changes are unsynced
  it prints a **visible** hint.
  Caveat (PR #176 review): the `import` nudge is emitted via `output.info()`, which only
  shows under `--verbose`/`--debug`, so it must not be copied verbatim.
  Route the hint through `output.notice()` (shown at the default level, suppressed by
  `--quiet` and `--json`). `--json` carries it as structured state instead:
  `{ results: [{ id, action, ok, skippedReason? }], summary: {...}, sync: { pending: true, hint: "..." } }`.
- **File/stdin bodies.** Add `--reason-file <path>` to `close`/`reopen`, and a shared
  `-` convention so `--reason -`, `-d -`, and `--notes -` read the body from stdin.
  This removes the P6 quoting hazard for big text without per-verb special cases.
- **Honest sync (decided: stage + opt-in `--sync`, tri-state intent).** Keep the
  stage-then-publish model: writes land in the sync worktree and are published by
  `tbd sync`. Phase 1 adds **no** per-command auto-sync.
  Two implementation details the current code forces (PR #176 review):
  - **Tri-state sync intent, not a boolean.** Today `getCommandContext()` derives
    `sync: opts.sync !== false`, so the *absence* of `--no-sync` reads as `true`; a
    naive `if (ctx.sync) sync()` would auto-sync every mutator and contradict this
    decision. Model intent explicitly as `unspecified | sync | no-sync` (a per-mutator
    `--sync` flag plus the legacy global `--no-sync`), where *unspecified* means
    stage-only. `--no-sync` stays accepted as a documented no-op for issue writes.
  - **Lock boundary: never nest the data-sync lock.** Apply all issue writes under one
    `withDataSyncContext({ lock: true })` pass, *release that lock*, and only then run
    the sync path (which re-takes the same non-reentrant lock and performs network I/O).
    `--sync` publishes once at the end, so a bulk write is a single call.

### API Changes (Phase 2, sketch only)

- **Query-driven mutation.** `tbd close --where "<filter>"` (and `update`, `reopen`)
  reusing the `list` filter vocabulary.
  **Prerequisite (PR #176 review):** that vocabulary is currently an
  implementation-local `ListOptions` shape inside `list.ts`, not a reusable selector.
  Phase 2 must first extract a shared selector module used by both `list` and the
  mutators, with tests proving read and write selection match.
  Always prints the matched set and count first; requires `--yes` above a small
  threshold, or `--dry-run` to preview only.
  Resolves P2 and P8.

- **Transaction file.** `tbd apply <file>` (or `... | tbd apply -`) applies a YAML/JSON
  document of mixed `create`/`close`/`update` operations under one lock, syncs once, and
  prints a structured summary.
  The clean answer to **creating many distinct issues** (which variadic cannot express,
  since each needs its own title/body) and to P6 at batch scale.
  It generalizes `import`. **Caveat (PR #176 review):** a real atomicity promise needs a
  transaction/rollback story spanning issue writes, ID-mapping updates, parent
  `child_order_hints`, and sync; a failure after mapping or hint writes could otherwise
  leave partial state.
  Phase 2 must specify that boundary.

  ```yaml
  # delivery.yml
  close:
    - ids: [fin-iri4, fin-kq1k, fin-c02g, fin-xgo2]
      reason: "Delivered via PR #78 (merged to integration/launch 2026-06-13)"
  create:
    - { title: "KNOWN_DESCRIPTORS completeness gate", type: task, priority: 3,
        parent: fin-g1gv, description_file: followup-1.md }
    - { title: "Reconcile fintool-server SEC mock shape", type: task, priority: 3,
        parent: fin-g1gv, description_file: followup-2.md }
  sync: true
  ```

## Implementation Plan

### Phase 1: Quick wins (current release)

- [ ] Make `close`, `reopen`, `update` accept `<ids...>` (mutators only; **not**
  `show`); single-ID behavior unchanged.
  Process all IDs under one locked data-sync context.
- [ ] Implement the validation/atomicity policy (validate-all-then-apply; `already-X` as
  a **bulk-only** skip while single-ID `close`/`reopen` keep current behavior;
  `--ignore-missing`); reject per-ID-only flags when multiple IDs are passed.
- [ ] Add the bulk summary line and the structured `--json` results array; emit the
  unsynced-changes hint via `output.notice()` (visible by default), **not**
  `output.info()` (which is `import`’s verbose-only nudge).
- [ ] Output contract (PR #176 review): keep `--quiet` **silent on success** (preserves
  the `cli-advanced.tryscript.md` quiet-create golden); default **text** mode prints the
  one-line summary; `--json` is the machine contract.
  Suppress worktree-heal and config-migration stderr notices under `--quiet` too, so
  `2>&1 | tail -1` is unnecessary.
- [ ] Add `--reason-file` to `close`/`reopen` and the shared `-`/stdin convention for
  `--reason`, `-d/--description`, and `--notes` (one shared body reader).
- [ ] Sync: model intent as tri-state (`unspecified | sync | no-sync`), default
  stage-only; add `--sync` (publish once at end), applying writes under the lock,
  releasing it, then syncing (no nested lock).
  Document `--no-sync` as a no-op for issue writes.
  Land the sync doc fixes in the manual, `tbd prime`, **and `tbd-design.md`** (see
  Rollout).
- [ ] Document the output contract (one-line summary; `--json` shape; what `--quiet`
  guarantees) in `tbd-docs.md` and the `cli-agent-skill-patterns` guideline examples.
- [ ] (Separate, read-only, optional this release) bulk `tbd show A B C` → delimited
  text / `--json` array; no write lock, no summary/sync contract.
  Tracked apart from the mutators.

### Phase 2: Broader (follow-on, separate design pass)

- [ ] Query-driven mutation (`--where` reusing the `list` grammar) with mandatory
  preview + `--yes` threshold.
- [ ] `tbd apply` transaction file generalizing `import`, with a structured summary and
  single sync.
- [ ] (Smaller follow-ons) First-class delivery provenance (P9), e.g.
  `close --by-pr <n>` recording structured provenance; a documented `verb [ids...]`
  spine future verbs inherit.

## Testing Strategy

- **tryscript e2e goldens** (the repo’s `.tryscript.md` harness): bulk
  close/reopen/update with mixed already-X and unknown IDs; `--ignore-missing`;
  single-ID backward compatibility; `--reason-file` and stdin bodies; the `--json`
  results array shape.
  Per the PR #176 review, also lock down:
  - `--sync` absent does **not** sync; `--sync` does; legacy `--no-sync` does not sync
    and is a documented no-op for issue writes.
  - the lock boundary around bulk-write-then-sync (no nested lock acquisition).
  - `reopen` already-open: single-ID errors (exit 1) vs bulk reports a skip.
  - `update --status closed` is rejected in bulk (or sets lifecycle metadata if ever
    added); bulk `update` otherwise touches only side-effect-free fields.
  - default text vs `--quiet` (silent on success) vs `--json` output contracts.
  - stdin bodies for `--reason -`, `--description -`, `--notes -` with shell-sensitive
    text (`$`, backticks, quotes).
- **vitest unit tests** for the validate-all-then-apply policy and the summary/exit-code
  logic (non-zero exit when any target failed under the default policy).
- Phase 2 gets its own test plan at design time.

## Rollout Plan

- Phase 1 is additive and backward-compatible, so it ships in the current release cycle.
  Update `packages/tbd/CHANGELOG.md`, the `tbd-docs.md` manual, `tbd prime`, the
  agent-CLI guideline examples, **and `tbd-design.md`** in the same change.
  Specifically fix the stale `--no-sync`/`auto_sync` “real issue-write behavior” claims
  in `tbd-docs.md` (~L805-827, L1094-1098, L1263-1267) and `tbd-design.md` (~L1608-1646,
  L2936-2961) so the repo stops carrying contradictory sync semantics (PR #176 review).
- Phase 2 ships in a later release after its own design pass; nothing in Phase 1 blocks
  on it, and Phase 1 establishes the conventions Phase 2 builds on.

## Open Questions

- **Sync model fork.** ~~Three options for the `--no-sync`/`auto_sync` vestige.~~
  **Resolved 2026-06-13: option (a)** keep stage-then-publish, make it self-revealing
  via the unsynced-changes hint, and add opt-in `--sync` for one push per batch.
  `--no-sync` becomes a documented no-op for issue writes; no per-command auto-sync is
  added. (Rejected: (b) per-command auto-sync behind `auto_sync`; (c) removing
  `--no-sync` outright.)
- **Default atomicity for bulk writes.** ~~Fail-closed vs best-effort?~~ **Resolved (PR
  #176 review): fail-closed by default** (abort the batch on any unknown ID), with
  `--ignore-missing` as the explicit best-effort escape hatch.
- **`--where` grammar reuse.** ~~Reuse `list`’s vocabulary?~~ **Resolved (PR #176
  review): yes, but Phase 2 must first extract a shared selector module** from
  `list.ts`’s implementation-local `ListOptions`, with tests proving read and write
  selection match.
- **Target release.** Confirm Phase 1 is intended for the current (v0.3.x) cycle.
- **Self-tracking.** Do we want this filed as a tbd epic + child beads linked to this
  spec via `--spec` (dogfooding the very ergonomics under discussion)?

## References

- Senior engineering review that tightened Phase 1:
  [PR #176](https://github.com/jlevy/tbd/pull/176) (jlevy, 2026-06-13).
- Motivating analysis and code findings: this repo’s command sources cited inline above
  (`close.ts`, `update.ts`, `reopen.ts`, `import.ts`, `output.ts`, `context.ts`,
  `data-context.ts`).
- Related (distinct) guideline plan:
  [plan-2026-06-03-tbd-agent-cli-guideline-improvements.md](plan-2026-06-03-tbd-agent-cli-guideline-improvements.md)
- Agent-CLI guideline: `tbd guidelines cli-agent-skill-patterns`
  ([packages/tbd/docs/guidelines/cli-agent-skill-patterns.md](../../../../packages/tbd/docs/guidelines/cli-agent-skill-patterns.md))
- Design doc (sync model): [tbd-design.md](../../../../packages/tbd/docs/tbd-design.md)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
