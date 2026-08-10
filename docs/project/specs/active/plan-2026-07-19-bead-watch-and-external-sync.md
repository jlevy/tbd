---
title: "Bead Watch and External Issue Sync"
description: Provider-neutral bead watching primitives any agent can use (tbd changes, tbd watch), plus the layering architecture that keeps external-tracker sync modular, additive, and incapable of destabilizing existing tbd workflows
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Bead Watch Infrastructure and External Sync Layering

**Date:** 2026-07-19 (last updated 2026-08-09)

**Author:** Joshua Levy

**Status:** Phase 1 (watch infrastructure) is implemented and release-smoke validated on
PR #205, pending merge.
Packed-artifact and credentialed-remote release QA is tracked by tbd-t750 and does not
gate the PR merge. External sync architecture is fixed in the Integration Layer section;
per-provider designs remain separate (tbd-vm5s).

## Overview

Make the bead graph a platform-neutral coordination bus for agents, in two separable
phases:

1. **Watch (Phase 1):** any agent — Claude Code, Codex, a cron worker, a human shell —
   can watch one, several, or all beads in a repo and wake when something changes,
   exactly the way agents already watch a GitHub issue.
   Ships as `tbd changes` and `tbd watch` with gh-style ergonomics, plus verified usage
   recipes for Claude Code and Codex.
2. **Sync (integration layer):** a curated subset of beads synchronizes with external
   trackers (Linear, GitHub, others) through cleanly separable integration modules built
   on top of the watch primitives — additive, explicitly invoked by whoever is working
   (an agent mid-session, cron, or CI), and incapable of destabilizing repos that do not
   use them. This spec fixes the architecture for that layer; per-provider designs are
   separate specs.

The design principle: because beads live as files on the sync branch, **change detection
is a git tip comparison**. Agents get their wake signal from git — no webhooks, no
always-on service, no vendor SDK on the watch path.
External surfaces can then be synced on a slow polled cadence without hurting agent
reaction time.

## Goals

- One command that blocks until a watched selection of beads changes, then reports what
  changed and exits — usable verbatim by any agent platform with a shell.
- Watch selections: a single bead, a list, label/spec/status filters, `--ready` (new
  ready work), or the whole repo.
- Verified, documented recipes for Claude Code and Codex, familiar in the way
  `gh run watch` and issue-polling loops are familiar.
- Agents communicate across sessions and platforms by writing to beads; watchers wake on
  those writes.
- A layered path to external-tracker sync: integrations are cleanly separable modules
  built over these primitives, additive by construction, so experimenting with a Linear,
  GitHub, or other bridge cannot destabilize existing tbd workflows (see Integration
  Layer).
- Zero always-on infrastructure: the watch is a git poll; an integration is an explicit
  command run by a working agent, a cron entry, or one scheduled CI workflow.

## Non-Goals

- Registering tbd as a Linear agent (agent sessions, delegation ACKs, typed activity
  streams, webhook receivers).
  That is a compatible later layer; nothing here forecloses it.
- Full tracker replication.
  Sync covers a **curated subset** with field ownership — the failure modes of naive
  bidirectional replication are well documented in beads’ own hardening history.
- A web UI or dashboard.
- Any issue schema, config schema, or `tbd_format` change.
  This landing is purely additive.
  The new change-report JSON has its own explicit `format_version: 1`, independent of
  the repository format, so integrations can consume it without coupling their
  experiments to tbd storage evolution.

## Background

- Beads live as one Markdown+YAML file per issue on the dedicated sync branch (see
  `tbd-design.md` §3); the whole graph is readable with a bare clone of that branch.
  Tip movement on that branch is a complete, cheap change signal — the property Phase 1
  is built on. The design doc’s §8.7 sketches external issue linking; the Integration
  Layer section below fixes how any implementation of it must be layered.
- Agents on every major platform already run “watch a GitHub issue, wake on change”
  loops; giving beads the same affordance makes the graph usable as a cross-agent
  message bus (agent A writes to a bead, agent B wakes).
- Merge semantics constrain who may write what: `extensions` merges whole-object LWW and
  `notes` is LWW-with-attic, so concurrent writers can shed a version to the attic.
  Safe high-frequency writes therefore come from either a single-writer integration or a
  conflict-free `comments` model (union-by-id), which remains a future option (see Open
  Questions).
- Upstream beads (`bd`) ships a hardened, polled Linear bridge whose invariants are the
  relevant prior art: external-ref bindings (never title matching), fail-closed state
  maps, idempotency markers, field-narrowed comparison, scoped creation, and a single
  writer. Its
  [Integration Charter](https://github.com/gastownhall/beads/blob/main/docs/INTEGRATION_CHARTER.md)
  deliberately scopes sync to polled metadata — the same shape adopted here — and
  [beads#2829](https://github.com/gastownhall/beads/issues/2829) describes the
  coordination-graph/execution-graph split this plan serves.

## Design

### Phase 1: Watch

Two commands: a pure primitive plus a blocking wrapper.

**`tbd changes`** — one-shot, non-blocking change report.

```bash
tbd changes --since <commit> [selection] [--json] [--quiet]
```

Diffs the configured local sync branch between a reference point and its current
committed tip. It performs no fetch and never reads the hidden worktree.
The command reports per-bead deltas for every substantive issue field in the normative
schema, including title, kind, status, priority, labels, assignee, hierarchy,
dependencies, spec link, scheduling, close metadata, extensions, and description/notes
text hunks. `version` and `updated_at` are synchronization metadata and do not trigger a
report. Created and deleted issue files are explicit change kinds; close and reopen
operations are status-field deltas.
Exit 0 with changes, exit 3 with none.
This is the testable core; `tbd watch` is a loop around it.

**`tbd watch`** — block until the selection changes, print what changed, exit.

```bash
tbd watch --bead tbd-a1b2 tbd-c3d4            # one or more beads
tbd watch --label needs-agent                # any bead with the label
tbd watch --spec plan-2026-07-19-bead-watch-and-external-sync.md
                                               # beads linked to a spec
tbd watch --status blocked                   # beads entering, leaving, or changing in status
tbd watch --ready                            # a new bead becomes ready
tbd watch --all                              # anything in the repo graph
  [--timeout <sec>] [--interval <sec>] [--since <commit>] [--json] [--quiet]
```

- **Mechanics:** poll `git ls-remote <remote> <sync-branch>` for tip movement (default
  interval 30s, minimum 10s); on movement, fetch the sync branch and run the
  `tbd changes` diff; if the selection changed, print and exit 0; otherwise keep
  waiting. No fetch traffic while the tip is idle.
- **Exit codes (gh-style):** 0 = change detected (report on stdout), 3 = timeout elapsed
  with no change (matching the `tbd changes` no-change code), 1 = error.
  Exit 2 stays reserved for usage errors, as on every tbd command, so recipes that retry
  on the no-change code never retry a usage error.
  `--json` emits the report as one JSON document for programmatic consumers.
- **Timeout boundary:** when the wait reaches `--timeout`, watch performs one final
  remote-tip observation before returning 3. A remote observation and its optional fetch
  share one bounded poll-interval budget, capped at 30 seconds.
  The command can therefore finish up to one bounded observation after the nominal
  timeout, but a stalled Git transport exits 1 instead of hanging indefinitely or
  falsely claiming no change.
- **Statelessness:** each invocation records nothing; `--since` lets a caller resume
  from a known commit, and the exit-0 report includes the new tip commit for chaining.
- **Poll resilience:** an established watch tolerates a bounded run of consecutive
  remote poll failures (each failed poll waits the normal interval) before exiting 1, so
  a brief network outage does not kill an unattended watch.
  Startup validation and the first remote read still fail fast.
  Every network-facing Git subprocess has an explicit timeout.
- **Safety:** watch is read-only — it never touches the caller’s working tree or the
  hidden data-sync worktree lock; fetches go to a private ref or temporary clone so a
  concurrent `tbd sync` is unaffected.

#### Phase 1 Detailed Contract

The following rules close ambiguities that would otherwise produce incompatible
watchers:

- **Baselines:** `tbd changes` requires `--since` and resolves both endpoints to commit
  IDs before reading their trees.
  The tip is the configured local sync-branch ref.
  `tbd watch` without `--since` takes the first remote tip it observes as its baseline
  and waits only for later movement.
  With `--since`, it immediately compares that commit with the current remote tip, so
  callers can resume without a race.
  A missing commit, missing remote sync branch, or baseline that is not an ancestor of
  the tip is an error rather than an all-created or force-push-shaped report.
  A missing local sync-branch tip tells the caller to run `tbd sync` first.
  If sync recovery rewrites history and invalidates a saved baseline, restart the watch
  without `--since` to establish a new baseline.

- **Advancement:** after remote movement that does not affect the selection, watch
  advances its baseline to that observed tip.
  A later wake therefore describes the exact interval that triggered it rather than
  replaying unrelated history from the start of the invocation.

- **Static and dynamic selections:** `--bead` resolves IDs against the union of the two
  snapshots’ append-only ID mappings.
  Without `--since`, watch validates explicit IDs against the local committed sync
  snapshot before its first remote poll, so a typo cannot wait indefinitely.
  With `--since`, the immediate two-snapshot report remains authoritative, including for
  a bead deleted after the baseline.
  Label, spec, and status filters reuse `tbd list` semantics: repeated labels are ANDed,
  spec paths use gradual path matching, and filters combine with AND. A changed bead
  matches a dynamic selection when it matched either endpoint, so entering and leaving a
  label/status/spec selection both wake the caller.
  `--ready` is intentionally edge-triggered: it reports only beads that match the
  combined predicate at the tip and did not match it at the baseline.
  This includes newly created ready beads and existing beads that become unblocked,
  unassigned, or open.
  `--all` is mutually exclusive with other selectors; `--bead` is mutually exclusive
  with dynamic filters.
  `tbd changes` defaults to all beads when no selector is given; `tbd watch` requires an
  explicit selector, including `--all`.

- **Issue snapshots:** readiness is calculated independently at both endpoints using
  each snapshot’s complete dependency graph.
  Each endpoint lists the committed issue tree and reads issue and mapping blobs through
  bounded `git cat-file --batch` groups of at most 128 objects, with a 50 MB
  process-output cap. This keeps valid large repositories independent of a single
  aggregate output buffer while bounding each child process.
  Invalid issue or mapping data fails the command loudly with the ref and path; it is
  never treated as an empty snapshot.

- **Determinism:** reports sort beads by internal ID and fields by normative schema
  order. Missing optional values are represented as `null`, but created and deleted beads
  omit fields that are `null` at both endpoints.
  Arrays retain their canonical stored order.
  Text changes use deterministic line hunks with old/new start and count values plus
  context/add/remove lines and at most three surrounding context lines.
  Myers trace growth is capped at edit distance 200; a larger rewrite still reports full
  before/after field values but sets `hunks_omitted: "complexity_limit"` rather than
  risking quadratic memory.
  Dynamic selections are applied before text diffing, so unrelated large bodies are not
  diffed. The substantive field-order table is compile-time exhaustive against `Issue`,
  excluding only identity and synchronization metadata.

- **Output:** human output identifies the baseline and tip, then renders one section per
  bead and field. JSON uses the same document for `changes` and an exit-0 `watch`:

  ```json
  {
    "format_version": 1,
    "since": "<full commit id>",
    "tip": "<full commit id>",
    "changes": [
      {
        "id": "tbd-a1b2",
        "internal_id": "is-...",
        "title": "Example",
        "change": "updated",
        "fields": [
          { "field": "status", "before": "open", "after": "closed" },
          {
            "field": "notes",
            "before": "old",
            "after": "old\nnew",
            "hunks": [
              {
                "old_start": 1,
                "old_count": 1,
                "new_start": 1,
                "new_count": 2,
                "lines": [
                  { "type": "context", "text": "old" },
                  { "type": "add", "text": "new" }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
  ```

  `format_version` versions this report document, not `.tbd/config.yml` or `tbd_format`.
  JSON no-change output is the same document with an empty `changes` array and exit 3. A
  watch timeout exits 3 without stdout.
  `--quiet` suppresses successful and no-change stdout (including JSON) so callers can
  use exit status alone; errors remain on stderr.

- **Private fetches:** every watch invocation uses a collision-resistant ref under a
  tbd-owned private namespace, fetches the exact configured sync branch only after tip
  movement, never writes `FETCH_HEAD` or the configured local/remote-tracking sync refs,
  and deletes its private ref on the normal `finally` path.
  At startup it also removes private refs whose encoded watcher PID is no longer alive,
  reclaiming refs left by signals or abrupt process termination.
  It does not initialize, inspect, repair, lock, fetch through, or otherwise access the
  hidden data-sync worktree.

### Agent Integration (Claude Code and Codex)

Two sanctioned patterns, shipped as a `watch-beads` shortcut and validated on both
platforms as part of this phase:

1. **Watch-then-spawn (daemon pattern, any platform).** The watch runs *outside* the
   agent; the expensive agent starts only on a wake.
   The shipped `watch-beads` shortcut includes the authoritative, syntax-tested Bash
   loop. It atomically persists each report as pending before launching a worker; pulls
   and revalidates current state; treats worker or final-sync failure as fatal while
   retaining the pending report; and advances a durable checkpoint only after both
   succeed. Restart therefore provides at-least-once delivery.
   Workers must make external actions idempotent because a crash after a side effect but
   before checkpointing can replay a report.
   The state name has one owner; separate selections use separate names.

2. **In-session watch (interactive pattern).** An agent mid-session watches a bead it is
   collaborating on. Platform notes to validate and document:
   - **Claude Code:** foreground Bash defaults to two minutes and can request at most
     ten minutes, so sessions either run `tbd watch --timeout 540` in a bounded loop
     across tool calls, or run the watch as a background task and let the harness’s
     completion notification wake the session.
     Current releases also offer a Monitor tool that can interject on command output;
     the platform validation records its availability and limits.
   - **Codex:** validate long-running command limits in Codex CLI sessions; the default
     recommendation is watch-then-spawn.

**Cross-agent coordination in Phase 1** uses existing primitives: an agent changes
replaceable bead state (notes, status, labels, close state), the change lands on the
sync branch, and watchers wake.
`tbd update --notes` replaces the whole notes body; it is not an append or comment
operation.
Notes are therefore safe as single-writer state after a pull, not as a durable
multi-writer transcript.
For a durable event/message history, agents create child beads or use an external
tracker with stable comment IDs.
Concurrent note replacements can shed a version to the attic for recovery, but the attic
is not a messaging protocol.
A union-by-ID `comments` model remains a possible later primitive.

### Integration Layer: External Sync (architecture)

The watch primitives above are deliberately provider-neutral and harness-neutral: any
agent that can run a shell command can wake on bead changes.
External-tracker synchronization (Linear, GitHub Issues, Jira, internal tools) is a
separate layer with a different risk profile: it talks to external APIs, holds
credentials, and embeds per-provider mapping policy.
This section fixes the architectural rules for that layer.
Detailed provider designs are separate specs, written and revised against these rules.

**Layering rules:**

1. **Sync is a separable module, never core plumbing.** A provider integration is a
   cleanly separable unit — a sibling package, or an isolated module in this repo that
   core never imports — with its own explicit entry point: a command or script that a
   working agent can run mid-session, a cron entry, or a CI workflow.
   Agents and repos that do not use integrations see no change to any tbd workflow.

2. **Integration experiments cannot touch `IssueSchema`, `ConfigSchema`, or
   `tbd_format`.** Both schemas parse in Zod strip mode, so an older CLI silently
   destroys unknown fields when it rewrites a file — which is why any new field forces a
   repo-wide format gate (see the forward-compatibility policy in `schemas.ts`).
   Integrations therefore keep bead-side bindings inside the sanctioned `extensions`
   namespace — a known field that round-trips through every existing CLI, designated for
   bridge and third-party metadata by the design doc — and keep operational state
   (watermarks, base snapshots, content hashes) in their own files, never in
   `.tbd/config.yml`.

3. **Core grows only small, generic enablers, each justified on its own.** Currently
   tracked:
   - `extensions` merge fix: whole-object LWW → `deep_merge_by_key` per design doc §3.5,
     so concurrent writers to different namespaces cannot drop each other (tbd-le2l). A
     bug fix against the written design, wanted with or without integrations.
   - Generic `extensions` read/write/display on the CLI, so integrations and third-party
     tools can bind metadata with no schema change (tbd-z95g).
   - Only if attribution proves necessary in practice: an actor convention (extensions-
     or label-based) before any schema field.

4. **Promotion requires evidence.** A first-class link field, a core `tbd bridge`
   command family, integration state directories on the sync branch, or folding sync
   into `tbd sync` are post-pilot standardization steps, each justified by a working
   integration — never prerequisites for one.
   If an experiment dies, nothing was standardized; if it succeeds, promotion is a
   mechanical migration with a working system behind it.

**Growth path.** Adoption widens gradually: an agent watching one bead, then label/spec
selections, then — where a repo wants it — `--all` watchers reacting to every change on
the repo. The shipped selection model already spans that range; wider adoption needs no
new primitives. Symmetrically, an integration can start one-way (import plus status
writeback) and grow field coverage as evidence accumulates.
Dispatch composes with no new machinery: a label set on the external surface reaches the
bead through the integration, and any watcher on that label wakes.

The invariants of upstream beads’ Integration Charter carry over as the quality bar for
any provider module: external-ref bindings (never title matching), fail-closed state
maps, idempotency markers, field-narrowed comparison, a single writer,
archive-don’t-delete.

### API Changes

New commands: `tbd changes` and `tbd watch`. `list` and `ready` now share their
selection predicates with the change engine through extracted helpers; their behavior is
unchanged and covered by existing tests.
One internal change: the watch poller uses a timeout-bearing non-interactive Git helper.
No schema changes, no config-schema changes, no format bump, and no behavior changes to
existing commands. The report document’s independent `format_version` starts at 1. All
stable CLI exit codes are defined in one shared module rather than split between error
classes and change commands.

## Implementation Plan

### Phase 1: Bead Watching

- [x] Senior engineering review: corroborate the architecture and make baseline,
  selection, output, validation, and private-fetch semantics testable and explicit.
- [x] `tbd changes` (`tbd-q1em`): sync-branch diff engine with selection filters and
  `--json`, unit-tested against synthetic sync-branch histories.
- [x] `tbd watch` (`tbd-l467`): ls-remote poll loop, selection wiring,
  timeout/interval/exit-code contract, human and JSON reports.
- [x] `watch-beads` shortcut (`tbd-h4tf`) documenting both agent patterns.
- [x] Claude Code validation (`tbd-q7rf`): background-task wake demo end-to-end (watch →
  bead update from a second session → wake → agent reads the report and replies on the
  bead).
- [x] Codex validation (`tbd-hb3p`): the watch-then-spawn demo via `codex exec`;
  document platform limits found.
- [x] Cross-agent demo (`tbd-2y7v`): two agent sessions conversing through one bead,
  each waking on the other’s write.
- [x] Post-review hardening (`tbd-md0g`): fail-fast ID validation, stale-ref
  reclamation, batched snapshot reads, bounded text hunks, concise created/deleted
  fields, selector compatibility, and actionable recovery guidance.
- [x] PR #205 review hardening: final timeout-boundary poll, bounded network Git
  subprocesses, bounded text-diff complexity and object batches, exhaustive substantive
  fields, report format version 1, durable at-least-once worker recipe, and accurate
  notes replacement semantics.
- [x] Release smoke and validation plan (`tbd-961h`): a built-candidate, real-Git,
  two-clone executable topology; complete automated/manual coverage map; and a manual QA
  playbook. The smoke found and regressed Git refmap isolation for an existing
  `origin/tbd-sync` ref.
- [ ] Release-candidate manual QA (`tbd-t750`): exact-tag artifact rerun, credentialed
  real remote, existing-workflow coexistence, network interruption, intended runner
  permissions/idempotency, and representative platform shells.
  This is a release promotion gate, not a PR or Linear gate.

Validation records and platform limits: `valid-2026-07-19-bead-watch-phase-1.md`,
`valid-2026-08-09-bead-watch-release.md`, and
`tests/qa/watch-infrastructure-release.qa.md`.

### Integration Enablers (tracked, not part of this landing)

None of these is a merge prerequisite for Phase 1. This branch’s versioned change
report, dynamic selections, and durable worker recipe are sufficient to run disposable
Linear experiments end to end while provider bindings and state remain outside core.

- [ ] `extensions` merge: `lww` → `deep_merge_by_key` per design doc §3.5 (tbd-le2l)
- [ ] Generic `extensions` read/write/display on the CLI (tbd-z95g)
- [ ] Rework the Linear pilot design to conform to the Integration Layer rules
  (tbd-vm5s, blocking tbd-g305). The old implementation phases are deferred; their
  detailed design on PR #197 is reference material, not current implementation
  authority.

## Testing Strategy

**Phase 1:** unit tests for `tbd changes` across synthetic histories (status flips,
notes replacements, creates/closes, selection filters); poll/deadline/failure tests; a
built-candidate two-clone release smoke over a real bare remote; recorded Claude Code
and Codex demos; timeout and error exit codes; protected Git-state snapshots; and the
full legacy, transcript, package, supply-chain, and cross-platform CI gates.

**Release QA:** run `pnpm qa:watch-release` on source and the exact packed artifact,
then follow `tests/qa/watch-infrastructure-release.qa.md` for a credentialed real
remote, existing-workflow coexistence, network interruption, durable-worker restart and
idempotency, platform shells, operator output, cleanup, and evidence capture.

## Open Questions

- Whether a conflict-free `comments` model (union-by-id) is needed before integrations
  write high-frequency inbound events.
  Until then, notes remain replaceable single-writer state; child beads or an external
  comment system carry durable multi-writer events.
- Where a proven integration module ultimately lives: a sibling package (keeps provider
  SDK dependencies out of the base install) versus an isolated module in this repo.
  Decided per provider at promotion time, not before.

## Addendum (2026-08-06): Extracted as the Watch-Infrastructure Plan of Record

Phase 1 was implemented and validated through PRs #196 and #197, then consolidated,
reviewed over three rounds, and hardened there.
This spec and the implementation were then extracted onto a clean branch from main as
their own landing, with the detailed external-sync design removed and replaced by the
Integration Layer architecture above.
The detailed Linear pilot design (field mapping tables, per-link base-snapshot state,
verified Linear API research) remains on
[PR #197](https://github.com/jlevy/tbd/pull/197) and is being reworked to conform to the
layering rules before any implementation (tbd-vm5s).

Phase 1 contract refinements from the #196/#197 review rounds, all included here:
fail-fast `--bead` validation before polling; stale private-ref reclamation; batched
`git cat-file --batch` snapshot reads (retiring the O(2N) `git show` concern, tbd-293h);
text hunks bounded to three context lines per side; created/deleted reports omit fields
null on both sides; an explicit empty `--spec` means no filter; a missing local sync
branch says to run `tbd sync` first; a watch timeout exits 3 — the shared no-match code
with `tbd changes` — so exit 2 stays reserved for usage errors and wake loops cannot
spin on a bad flag; private-ref cleanup is best-effort so it can never discard a report
the watch just produced; and an established watch rides out a bounded run of failed
remote polls.

## Addendum (2026-08-09): Release Validation and Git Refmap Isolation

PR #205 now includes a repeatable release smoke (`pnpm qa:watch-release`) that creates a
bare remote and independent writer/watcher clones, publishes real sync-branch movement,
blocks in `tbd watch`, validates the versioned report and exit codes, snapshots
protected Git state, pulls normally, exercises legacy commands, renders `watch-beads`,
and removes the topology.

That smoke found a gap the prior real-Git fixture could not expose because the fixture
had no existing remote-tracking sync ref.
Git may opportunistically apply `remote.origin.fetch` even when an explicit private
destination ref is supplied.
The watch fetch now passes an empty `--refmap=`; the focused fixture begins with a stale
`origin/tbd-sync`, and both it and the two-clone smoke prove that ref stays unchanged.

The full release decision is recorded in `valid-2026-08-09-bead-watch-release.md`. The
exact-tag artifact rerun and credentialed-remote execution remain tracked by tbd-t750.
Linear experimentation remains explicitly non-gating.

## References

- `tbd-design.md` §3 (sync-branch architecture, merge strategies) and §8.7 (external
  issue linking sketch)
- [beads Integration Charter](https://github.com/gastownhall/beads/blob/main/docs/INTEGRATION_CHARTER.md)
  and [beads#2829](https://github.com/gastownhall/beads/issues/2829) (the
  coordination/execution split)
