---
title: "Bead Watch and External Issue Sync"
description: Let any agent watch beads and wake on changes (like watching a GitHub issue), then bidirectionally sync a curated subset of beads with Linear issues and GitHub PRs via a polled single-writer bridge
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Bead Watch and External Issue Sync

**Date:** 2026-07-19 (last updated 2026-07-19)

**Author:** Joshua Levy

**Status:** Draft

## Overview

Make the bead graph a platform-neutral coordination bus for agents, in two separable
phases:

1. **Watch (Phase 1):** any agent — Claude Code, Codex, a cron worker, a human shell —
   can watch one, several, or all beads in a repo and wake when something changes,
   exactly the way agents already watch a GitHub issue.
   Ships as `tbd changes` and `tbd watch` with gh-style ergonomics, plus verified usage
   recipes for Claude Code and Codex.
2. **Sync (Phase 2):** a curated subset of beads synchronizes bidirectionally (under
   explicit field ownership) with external issues — Linear as a human-facing surface,
   GitHub PRs (and optionally GitHub Issues) inbound — so a change on any bound surface
   lands in the bead, and every watching agent sees it.

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
- Bidirectional bead↔Linear sync and PR↔bead binding: inbound events (comments, state,
  priority, PR lifecycle) land in beads; outbound projection keeps a curated external
  frontier current; merged PRs close beads.
- Zero always-on infrastructure: the bridge is one scheduled CI workflow; the watch is a
  git poll.

## Non-Goals

- Registering tbd as a Linear agent (agent sessions, delegation ACKs, typed activity
  streams, webhook receivers).
  That is a compatible later layer; nothing here forecloses it.
- Full tracker replication.
  Sync covers a **curated subset** with field ownership — the failure modes of naive
  bidirectional replication are well documented in beads’ own hardening history.
- A web UI or dashboard.

## Background

- Beads live as one Markdown+YAML file per issue on the dedicated sync branch (see
  `tbd-design.md` §3); the whole graph is readable with a bare clone of that branch.
  Tip movement on that branch is a complete, cheap change signal — the property Phase 1
  is built on. The design doc’s §8.7 sketches external issue linking; this plan
  implements a concrete version of it.
- Agents on every major platform already run “watch a GitHub issue, wake on change”
  loops; giving beads the same affordance makes the graph usable as a cross-agent
  message bus (agent A writes to a bead, agent B wakes).
- Merge semantics constrain who may write what: `extensions` merges whole-object LWW and
  `notes` is LWW-with-attic, so concurrent writers can shed a version to the attic.
  Safe high-frequency writes therefore come from either a single-writer bridge or a
  conflict-free `comments` model (union-by-id), which Phase 2 adds.
- Upstream beads (`bd`) ships a hardened, polled Linear bridge whose invariants are the
  relevant prior art: external-ref bindings (never title matching), fail-closed state
  maps, idempotency markers, field-narrowed comparison, scoped creation, and a single
  writer. Its
  [Integration Charter](https://github.com/gastownhall/beads/blob/main/docs/INTEGRATION_CHARTER.md)
  deliberately scopes sync to polled metadata — the same shape adopted here — and
  [beads#2829](https://github.com/gastownhall/beads/issues/2829) describes the
  coordination-graph/execution-graph split this plan serves.
- Linear’s platform supports everything the polled bridge needs with no webhooks:
  `updatedAt` filter queries for watermark polling, long-lived personal API keys, hidden
  HTML-comment markers in descriptions, and attachment URLs as per-issue idempotency
  keys ([Linear developer docs](https://linear.app/developers)).

## Design

### Phase 1: Watch

Two commands: a pure primitive plus a blocking wrapper.

**`tbd changes`** — one-shot, non-blocking change report.

```bash
tbd changes --since <commit> [selection] [--json]
```

Diffs the sync branch between a reference point and its current tip, restricted to the
selection, and reports per-bead deltas: status, priority, labels, assignee, parent,
dependencies, spec link, description/notes appends (as text hunks), created, closed.
Exit 0 with changes, exit 3 with none.
This is the testable core; `tbd watch` is a loop around it.

**`tbd watch`** — block until the selection changes, print what changed, exit.

```bash
tbd watch --bead tbd-a1b2 [tbd-c3d4 ...]     # one or more beads
tbd watch --label needs-agent                # any bead with the label
tbd watch --spec plan-2026-07-19-*.md        # beads linked to a spec
tbd watch --ready                            # a new bead becomes ready
tbd watch --all                              # anything in the repo graph
  [--timeout <sec>] [--interval <sec>] [--since <commit>] [--json] [--quiet]
```

- **Mechanics:** poll `git ls-remote <remote> <sync-branch>` for tip movement (default
  interval 30s, minimum 10s); on movement, fetch the sync branch and run the
  `tbd changes` diff; if the selection changed, print and exit 0; otherwise keep
  waiting. No fetch traffic while the tip is idle.
- **Exit codes (gh-style):** 0 = change detected (report on stdout), 2 = timeout elapsed
  with no change, 1 = error.
  `--json` emits the report as one JSON document for programmatic consumers.
- **Statelessness:** each invocation records nothing; `--since` lets a caller resume
  from a known commit, and the exit-0 report includes the new tip commit for chaining.
- **Safety:** watch is read-only — it never touches the caller’s working tree or the
  hidden data-sync worktree lock; fetches go to a private ref or temporary clone so a
  concurrent `tbd sync` is unaffected.

### Agent Integration (Claude Code and Codex)

Two sanctioned patterns, shipped as a `watch-beads` shortcut and validated on both
platforms as part of this phase:

1. **Watch-then-spawn (daemon pattern, any platform).** The watch runs *outside* the
   agent; the expensive agent starts only on a wake:

   ```bash
   while tbd watch --ready --json > /tmp/wake.json; do
     claude -p "New bead activity: $(cat /tmp/wake.json). Act per conventions." || true
   done
   # identically: codex exec "..." — the runner is agent-agnostic
   ```

2. **In-session watch (interactive pattern).** An agent mid-session watches a bead it is
   collaborating on. Platform notes to validate and document:
   - **Claude Code:** foreground Bash calls have a hard per-call timeout (10 minutes),
     so sessions either run `tbd watch --timeout 540` in a bounded loop across tool
     calls, or run the watch as a background task and let the harness’s completion
     notification wake the session — the natural fit.
   - **Codex:** validate long-running command limits in Codex CLI sessions; the default
     recommendation is watch-then-spawn.

**Cross-agent communication in Phase 1** uses existing primitives: an agent writes with
`tbd update <id> --notes ...` (or closes/labels), the change lands on the sync branch,
and watchers wake. Concurrent note writes can shed a version to the attic; acceptable at
message frequency and retired by the Phase 2 `comments` model.
The watch report shows notes appends as diffs, so a woken agent reads the message
without extra commands.

### Phase 2: External Sync

**tbd primitives:**

- **`comments` model**: `comments: [{id, author, source, created_at, body}]` with
  union-by-id merge (conflict-free by construction) and a `tbd comment <id> <text>`
  command. This is the landing spot for inbound sync events and the safe cross-agent
  message primitive.
- **Per-namespace `extensions` merge** (replacing whole-object LWW), enabling structured
  external bindings (e.g. `extensions.linear = {issue, url}`); until it lands, bindings
  ride a label (e.g. `linear:ENG-42`) plus the external-side markers.

**`tbd mirror`** — a provider-adapter sync command family, designed to run as a single
writer from CI:

```bash
tbd mirror pull  [--provider linear|github] [--dry-run]   # collector: external → beads
tbd mirror push  [--provider linear] [--dry-run]          # projector: beads → external
tbd mirror status | doctor
```

- **Collector (pull):** watermark polling — one Linear GraphQL query for bound issues
  with `updatedAt` past the stored watermark; one `gh` search for bound PRs/issues
  updated past theirs.
  Events append to bound beads as comments; field writebacks are whitelist-only (e.g.
  human priority change, human close/cancel).
  Inbound text is data for agents and humans, never auto-executed instructions.
- **Projector (push):** a rule-selected frontier (epics with spec links, top priorities,
  `mirror:on`/`mirror:off` label overrides) rendered into external issues with a managed
  description block (bead id, rollup counts of unexposed descendants, latest PR) between
  HTML-comment markers; fail-closed state mapping validated against the team’s actual
  workflow states; field-narrowed diffs; archive-don’t-delete; an optional pluggable
  **redaction gate** (deny-pattern list; a violation fails the push rather than
  publishing) for repos with confidentiality constraints; optionally an index emitter
  that renders a repo TODO/index file from the same selection pass.
- **Bindings and idempotency:** bead label plus a hidden `<!-- tbd:bead <id> -->` marker
  in the external description plus (Linear) an attachment URL as the per-issue
  idempotency key; a state file (watermarks, bindings, last-applied content hashes)
  committed by the bridge with a `[skip-bridge]` commit marker so it never triggers
  itself. **Echo suppression is content-based**: inbound changes confined to bridge-owned
  fields matching the stored hash are ignored — which is what lets the bridge run on a
  long-lived personal API key with no OAuth app or token refresh.
- **Closer:** merged PRs close their beads.
  The dependable join is a PR-body marker (`<!-- tbd:bead <id> -->`) stamped at
  `gh pr create|edit` time by a hook (for Claude Code, a PostToolUse hook; any platform
  can use a git/CI check), with bead IDs in commit subjects as fallback — commit
  conventions alone are unreliable in practice.
  Unresolvable merged PRs are reported, never silently dropped.
- **Reference workflow:** a documented CI recipe (GitHub Actions example) — cron plus
  sync-branch push triggers, a concurrency group making the bridge the sole writer,
  `tbd mirror pull && tbd mirror push` plus the closer, and a drift report (including a
  staleness check: `in_progress` beads with no update past a TTL).

Dispatch composes without new machinery: a label set on the external issue reaches the
bead via the collector, and any watcher on that label picks it up (pattern 1 above).

### API Changes

New commands: `tbd changes`, `tbd watch` (Phase 1); `tbd comment`, `tbd mirror` (Phase
2). New config: `[mirror]` section (provider, team/project ids, state map, frontier
rules, redaction list path).
Schema: `comments` field; `extensions` merge strategy change.
No breaking changes to existing commands.

## Implementation Plan

### Phase 1: Bead Watching

- [ ] `tbd changes`: sync-branch diff engine with selection filters and `--json`,
  unit-tested against synthetic sync-branch histories.
- [ ] `tbd watch`: ls-remote poll loop, selection wiring, timeout/interval/exit-code
  contract, human and JSON reports.
- [ ] `watch-beads` shortcut documenting both agent patterns.
- [ ] Claude Code validation: background-task wake demo end-to-end (watch → bead update
  from a second session → wake → agent reads the report and replies on the bead).
- [ ] Codex validation: the watch-then-spawn demo via `codex exec`; document platform
  limits found.
- [ ] Cross-agent demo: two agent sessions conversing through one bead, each waking on
  the other’s write.

### Phase 2: External Sync

- [ ] `comments` model with union-by-id merge, `tbd comment`, and concurrent-writer
  regression tests.
- [ ] Per-namespace `extensions` merge with concurrent-writer regression tests.
- [ ] `tbd mirror pull` (Linear + GitHub PR collectors, watermark state, whitelisted
  writebacks).
- [ ] `tbd mirror push` (frontier rules, managed block, fail-closed state map,
  field-narrowed diff, redaction gate, index emitter).
- [ ] Closer plus the PR-marker hook recipe.
- [ ] Reference CI workflow and setup docs (provider config, state map, API key).
- [ ] End-to-end test against a dev Linear workspace (see Testing Strategy).

## Testing Strategy

**Phase 1:** unit tests for `tbd changes` across synthetic histories (status flips,
notes appends, creates/closes, selection filters); a two-session live test (session B
updates a bead; session A’s watch exits within interval + sync latency with the correct
delta); recorded Claude Code and Codex demos; timeout and error exit codes; watch does
not disturb a concurrent `tbd sync`.

**Phase 2:** scripted end-to-end against a dev Linear workspace: projection appears with
managed block and marker; an external comment lands in the bead within one cycle and a
watcher wakes on it; a dispatch label round-trips; a marker-stamped PR merge closes the
bead and moves the external issue per the state map; a no-change bridge cycle produces
zero mutations (echo suppression and field-narrowed diff converge); a seeded
deny-pattern term hard-fails the push; stale watermark replay is idempotent; concurrent
`tbd comment` writers all survive the merge.

## Open Questions

- Poll interval default (30s proposed) and whether `--ready` honors priority filters in
  v1.
- Whether GitHub Issues get a push surface alongside Linear in Phase 2, or the GitHub
  adapter stays pull-only (PRs) until there is demand.
- Whether `tbd mirror` belongs in core or a sibling package (`@tbd/mirror`) to keep
  provider SDK dependencies out of the base install.
- Timing of the `comments` model: scheduled first in Phase 2; pull it into Phase 1 only
  if attic-shedding on notes proves noisy in the cross-agent demo.

## References

- `tbd-design.md` §3 (sync-branch architecture, merge strategies) and §8.7 (external
  issue linking sketch)
- [beads Integration Charter](https://github.com/gastownhall/beads/blob/main/docs/INTEGRATION_CHARTER.md)
  and [beads#2829](https://github.com/gastownhall/beads/issues/2829) (the
  coordination/execution split)
- [Linear developer docs](https://linear.app/developers) (filter queries, attachments,
  API keys)
- [Cyrus PrMarkerHook](https://github.com/cyrusagents/cyrus/blob/main/packages/edge-worker/src/hooks/PrMarkerHook.ts)
  (public prior art for hook-stamped PR-body markers)
