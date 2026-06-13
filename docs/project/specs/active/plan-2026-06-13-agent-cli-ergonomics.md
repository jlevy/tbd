---
title: "Agent CLI Ergonomics: Bulk Ops, Output Contract, and Sync Clarity"
description: Reduce agent bash contortions (for-loops over issues, output truncation, sync rituals) by adding bulk/multi-target verbs, a trustworthy output contract, and a clear sync model
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Agent CLI Ergonomics (Bulk Ops, Output Contract, Sync Clarity)

**Date:** 2026-06-13 (last updated 2026-06-13)

**Author:** Joshua Levy

**Status:** Draft

## Overview

Agents drive tbd through bash, and when a task touches more than one issue they fall back
to error-prone shell contortions: `for` loops over issue IDs, `2>&1 | tail -1` on every
command to tame output, `echo "=== ... ==="` headers to hand-roll a progress display, and
a `--no-sync ... ; tbd sync` ritual to manage syncing. These patterns are brittle, hide
what happened from the user, and make multi-issue work the most failure-prone thing an
agent does with tbd.

This spec catalogs the common problems, then proposes a **layered** fix that front-loads
backward-compatible **quick wins** suitable for the current release (multi-target verbs, a
trustworthy output contract, and an honest sync model) and maps out **broader ideas**
(query-driven mutation, a transaction-file `apply` command) as follow-on work.

It is a product/runtime change to tbd's own CLI. It is distinct from
[plan-2026-06-03-tbd-agent-cli-guideline-improvements.md](plan-2026-06-03-tbd-agent-cli-guideline-improvements.md),
which improves the *guideline* about writing agent skills; this spec changes how tbd's
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

Every awkward thing here maps to a missing tbd primitive (see Problem Catalog). After
Phase 1 the close loop collapses to a single call:

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
- **Remove the shell-quoting hazard** for large text fields (reasons, descriptions, notes)
  by supporting file and stdin bodies consistently across verbs.
- **Prioritize backward-compatible quick wins** that can ship in the current release, and
  map the larger ideas without committing to them yet.
- **Establish a consistent verb spine** (`verb [ids...] --flags`) future commands inherit.

## Non-Goals

- Owning git/gh plumbing (PR merge, worktree/branch cleanup). tbd will not wrap these;
  only the issue-tracking half of the motivating example is in scope.
- A general query/expression language beyond what `list` already understands. Phase 2
  reuses the existing filter grammar; it does not invent a new one.
- Changing the on-disk issue format or the sync-worktree storage model.
- Interactive TUI work. The output contract targets piped/non-TTY agent use first.

## Background

Findings from the current code (cited so the plan is grounded, not speculative):

- The core mutators each take exactly one ID:
  [`close.ts:88`](../../../../packages/tbd/src/cli/commands/close.ts),
  [`update.ts:431`](../../../../packages/tbd/src/cli/commands/update.ts),
  [`reopen.ts:91`](../../../../packages/tbd/src/cli/commands/reopen.ts),
  and `show.ts:194` all declare `.argument('<id>')`.
- The repo already uses variadic args idiomatically elsewhere:
  `label.ts:201` (`<labels...>`) and `docs-fork.ts:762` (`[names...]`). The mutators are
  inconsistent, not idiomatically blocked.
- Argument conventions are uneven: `label add <id> <labels...>` is variadic on the *label*
  axis (one issue, many labels), `dep add <issue> <depends-on>` is pairwise, `docs fork
  [names...]` is variadic, and the issue mutators are single. There is no shared `verb
  [ids...] --flags` spine.
- `success()` already prints exactly one line ([`output.ts:382`](../../../../packages/tbd/src/cli/lib/output.ts)),
  but two stderr notices can interleave with it: worktree auto-heal
  ([`data-context.ts:183`](../../../../packages/tbd/src/cli/lib/data-context.ts)) and
  config migration (`data-context.ts:164`).
- **`--no-sync` is effectively a no-op for issue writes.** The `sync` boolean is set in
  [`context.ts:46`](../../../../packages/tbd/src/cli/lib/context.ts) but read by no
  mutator; `auto_sync` has no issue-level consumer in `src/` (only the docs cache honors
  `doc_auto_sync_hours`). Writes stage into the hidden sync worktree and are published
  only by `tbd sync`.
- The right shape already exists in one place: `import` ingests many issues under a single
  lock, prints one summary line, and nudges
  *"Run `tbd sync` to commit and push imported issues"*
  ([`import.ts:293`](../../../../packages/tbd/src/cli/commands/import.ts)). The mutators
  should adopt the same shape.

## Problem Catalog

The common problems agents hit, each with the bash symptom it produces:

1. **P1: Single-target mutators force shell loops.** `close`/`reopen`/`update`/`show` take
   one `<id>`, so N issues become `for b in ...; do tbd close $b ...; done`. Each iteration
   re-acquires the repo lock and re-resolves the worktree (N times the work), and a
   mid-loop failure leaves a partially-applied change with no transaction boundary.

2. **P2: No query-driven mutation (no select-and-act).** There is no way to express "close
   all open children of X" or "label everything matching Y" without first listing, parsing
   IDs out of text/JSON, and looping. The read side has filters (`list`, `ready`,
   `blocked`, `stale`, `search`); the write side cannot consume them.

3. **P3: Output is not trusted, so agents truncate it.** Despite the single-line
   `success()`, agents defensively pipe `2>&1 | tail -1` because they cannot be sure how
   many lines a command emits, stderr notices interleave with stdout, and in a loop they
   only want the final line. `tail -1` then swallows real errors, hiding failures.

4. **P4: No structured, user-visible record of a multi-step session.** The agent
   hand-rolls a UI with `echo "=== ... ==="` because tbd surfaces nothing to the user. A
   multi-issue tbd session is invisible unless the agent narrates it, and there is no
   machine- and human-readable "here is the batch I just applied" summary.

5. **P5: The sync model is murky and partly vestigial.** `--no-sync` is consumed by no
   mutator and `auto_sync` is not wired for issues, yet both *imply* a per-command sync.
   Agents cargo-cult `--no-sync` on each write and append a final `tbd sync`, getting the
   right outcome by accident. Nothing tells the agent "you have N unsynced changes."

6. **P6: Large text fields inline in the shell are a quoting and correctness hazard.**
   Multi-paragraph `--reason "..."` / `-d '...'` strings containing `$`, backticks,
   quotes, or `#` are pasted straight into bash, risking interpolation, truncation, or
   command injection, and are not reviewable. `create` already supports `--file`/`-f` and
   `update` supports `--notes-file`, but `close --reason` has no file form and there is no
   batch equivalent or shared stdin (`-`) convention.

7. **P7: Inconsistent argument conventions.** Without a `verb [ids...] --flags` spine,
   agents cannot generalize muscle memory across verbs and reach for bash instead (see
   Background for the specific inconsistencies).

8. **P8: No preview/confirm discipline for set-based writes.** `--dry-run` exists globally
   but there is no "show the N items this would touch, then apply" affordance, which is
   exactly what makes query-driven mutation (P2) safe to offer.

9. **P9 (adjacent, broader): "delivered by PR #N" has no first-class expression.** The
   recurring intent "close these as delivered via PR #78" always degrades into bespoke
   bash and an unstructured reason string, so the provenance is not queryable later. Out
   of tbd's direct control for the git half, but the bead half could be first-class.

## Design

### Approach

Layer the work so value lands early and risk stays low:

- **Phase 1 (quick wins, current release):** purely additive, backward-compatible changes
  to existing verbs. Multi-target IDs, a bulk summary + accurate sync hint, file/stdin
  bodies for reasons, and an honest sync contract. No new top-level commands.
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

- **Variadic IDs.** Change `close`/`reopen`/`update`/`show` from `<id>` to `<ids...>`.
  A single ID behaves exactly as today. Multiple IDs are processed under one
  `withDataSyncContext({ lock: true })` pass.
  - `tbd close A B C --reason "..."` applies the shared reason to all.
  - `tbd update A B C --status closed --add-label delivered` applies shared field updates
    to all. Per-ID-only flags (e.g. `--title`) are rejected when more than one ID is
    given.
  - **Validation/atomicity (default, fail-closed):** resolve all IDs first; if any is
    unknown, abort before writing anything and list the bad IDs. `already-closed` is a
    reported *skip*, not a failure. `--ignore-missing` downgrades unknown IDs to skips.
    (Exact default is an Open Question.)
- **Bulk summary + sync hint.** A multi-target write prints one deterministic summary line
  (text mode), e.g. `Closed 3, skipped 1 (already closed): fin-iri4 fin-kq1k fin-c02g`,
  and, when changes are unsynced, the same nudge `import` already uses. `--json` returns a
  structured result array: `{ results: [{ id, action, ok, skippedReason? }], summary: {...} }`.
- **File/stdin bodies.** Add `--reason-file <path>` to `close`/`reopen`, and a shared `-`
  convention so `--reason -`, `-d -`, and `--notes -` read the body from stdin. This
  removes the P6 quoting hazard for big text without per-verb special cases.
- **Honest sync (decided: stage + opt-in `--sync`).** Keep the stage-then-publish model:
  writes land in the sync worktree and are published by `tbd sync`. Make it
  self-revealing: every mutator prints an unsynced-changes hint (the same nudge `import`
  uses) when changes are pending. Add `--sync` to the mutators to publish once at the end
  of the operation (equivalent to a trailing `tbd sync`, inside the same invocation), so a
  bulk write is a single call. Phase 1 adds **no** per-command auto-sync; `--no-sync`
  becomes a documented no-op for issue writes (there is no auto-sync to skip), and the
  canonical controls are explicit `tbd sync` and `--sync`.

### API Changes (Phase 2, sketch only)

- **Query-driven mutation.** `tbd close --where "<filter>"` (and `update`, `reopen`)
  reusing the **existing `list` filter grammar** (status, priority, label, parent, spec,
  etc.). Always prints the matched set and count first; requires `--yes` to apply above a
  small threshold, or `--dry-run` to preview only. Directly resolves P2 and P8.
- **Transaction file.** `tbd apply <file>` (or `... | tbd apply -`) applies a YAML/JSON
  document of mixed `create`/`close`/`update` operations atomically under one lock, syncs
  once, and prints a structured summary. This is the clean answer to **creating many
  distinct issues** (which variadic cannot express, since each needs its own title/body)
  and to P6 at batch scale. It generalizes `import` rather than adding a parallel path.

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

- [ ] Make `close`, `reopen`, `update`, `show` accept `<ids...>`; single-ID behavior
  unchanged. Process all IDs under one locked data-sync context.
- [ ] Implement the validation/atomicity policy (validate-all-then-apply; `already-X` as a
  skip; `--ignore-missing`); reject per-ID-only flags when multiple IDs are passed.
- [ ] Add the bulk summary line and the structured `--json` results array; reuse the
  `import` "unsynced changes, run `tbd sync`" nudge.
- [ ] Make `--quiet` collapse multi-target output to a single line and ensure incidental
  stderr notices are suppressed under `--quiet`, so `2>&1 | tail -1` is unnecessary.
- [ ] Add `--reason-file` to `close`/`reopen` and the shared `-`/stdin convention for
  `--reason`, `-d/--description`, and `--notes`.
- [ ] Add `--sync` to the mutators (publish once at end) plus the unsynced-changes hint;
  keep stage-then-publish (no per-command auto-sync) and document `--no-sync` as a no-op
  for issue writes. Update the manual and `tbd prime` to state the stage-then-publish model
  in one place.
- [ ] Document the output contract (single-line success; `--json` shape; what `--quiet`
  guarantees) in `tbd-docs.md` and the `cli-agent-skill-patterns` guideline examples.

### Phase 2: Broader (follow-on, separate design pass)

- [ ] Query-driven mutation (`--where` reusing the `list` grammar) with mandatory
  preview + `--yes` threshold.
- [ ] `tbd apply` transaction file generalizing `import`, with a structured summary and
  single sync.
- [ ] (Smaller follow-ons) First-class delivery provenance (P9), e.g. `close --by-pr <n>`
  recording structured provenance; a documented `verb [ids...]` spine future verbs inherit.

## Testing Strategy

- **tryscript e2e goldens** (the repo's `.tryscript.md` harness) for each new form: bulk
  close/reopen/update with mixed already-closed and unknown IDs; `--ignore-missing`;
  single-ID backward compatibility; `--reason-file` and stdin bodies; `--quiet`
  single-line output; the `--json` results array shape.
- **vitest unit tests** for the validate-all-then-apply policy and the summary/exit-code
  logic (non-zero exit when any target failed under the default policy).
- A golden that asserts `--quiet` emits exactly one line (or nothing) with the worktree
  auto-heal and config-migration notices suppressed, locking the P3 fix.
- Phase 2 gets its own test plan at design time.

## Rollout Plan

- Phase 1 is additive and backward-compatible, so it ships in the current release cycle.
  Update `packages/tbd/CHANGELOG.md`, the `tbd-docs.md` manual, `tbd prime`, and the
  agent-CLI guideline examples in the same change.
- Phase 2 ships in a later release after its own design pass; nothing in Phase 1 blocks
  on it, and Phase 1 establishes the conventions Phase 2 builds on.

## Open Questions

- **Sync model fork.** ~~Three options for the `--no-sync`/`auto_sync` vestige.~~
  **Resolved 2026-06-13: option (a)** keep stage-then-publish, make it self-revealing via
  the unsynced-changes hint, and add opt-in `--sync` for one push per batch. `--no-sync`
  becomes a documented no-op for issue writes; no per-command auto-sync is added.
  (Rejected: (b) per-command auto-sync behind `auto_sync`; (c) removing `--no-sync`
  outright.)
- **Default atomicity for bulk writes.** Fail-closed (abort the whole batch on any unknown
  ID, recommended for predictability) vs. best-effort (apply the valid ones, report the
  rest)? `--ignore-missing` covers the latter either way.
- **`--where` grammar reuse.** Confirm Phase 2 reuses the exact `list` filter vocabulary
  (learn-once for read and write) rather than introducing a separate selector syntax.
- **Target release.** Confirm Phase 1 is intended for the current (v0.3.x) cycle.
- **Self-tracking.** Do we want this filed as a tbd epic + child beads linked to this spec
  via `--spec` (dogfooding the very ergonomics under discussion)?

## References

- Motivating analysis and code findings: this repo's command sources cited inline above
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
