---
title: "tbd web: Live Bead View"
description: An optional local web view over committed bead state, driven by the watch layer and sharing the CLI's query semantics
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: `tbd web` — Live Bead View

**Date:** 2026-08-10 (last updated 2026-08-10)

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Draft

## Overview

A single optional command, `tbd web`, serves a loopback-only page that renders the bead
graph and updates itself as committed state moves.
It is a read-first view built on the watch infrastructure from
`plan-2026-07-19-bead-watch-and-external-sync.md`: the same additive-only JSON report
that wakes an agent also wakes a browser tab (see tbd-design.md §4.14).

The governing constraint is that the browser must not become a second, drifting
implementation of `tbd list`. Every filter the UI offers is a CLI flag, evaluated by the
CLI’s own predicates, and each response carries the equivalent command line.

A working spike exists at `packages/tbd/scripts/bead-web.ts` and
`packages/tbd/scripts/bead-web.html`. This plan describes what it would take to promote
it, and what must be true first.

## Goals

- One optional command that renders committed bead state and stays current without a
  manual refresh.
- Exactly one query implementation shared by `list`, `ready`, `changes`, `watch`, and
  `web`. The UI cannot express a filter the CLI cannot, and cannot evaluate one
  differently.
- Every view is reproducible from the terminal.
  The page always shows the `tbd list` invocation equivalent to what is on screen.
- No new runtime dependency, no schema change, no `tbd_format` bump, and no behavior
  change for repositories that never run the command.
- Legible change: when state moves, the affected rows say so, including which fields
  changed and how.
- Fast on a real graph.
  Interaction stays immediate at 5,000 to 10,000 issues, matching the performance goal
  in tbd-design.md §1.4.

## Non-Goals

- No general-purpose issue-tracker UI. No boards, no drag-and-drop, no charts, no saved
  views, no multi-repo dashboard.
- No non-loopback bind, no authentication, no multi-user session model.
  A remote-reachable surface is a separate proposal with its own security review.
- No daemon. The server lives and dies with the foreground command.
- No write surface beyond a deliberately narrow, flag-gated status and notes edit.
  Bulk mutation, creation, dependency editing, and merge conflict resolution stay in the
  CLI.
- No replacement for `tbd list`, `tbd show`, or `tbd ready`. The view is additive.
- No provider integration.
  This is orthogonal to the Linear work tracked under `tbd-vm5s`.

## Background

### The design tension, stated plainly

tbd-design.md §1.6 lists “TUI/GUI interfaces” as an explicit non-goal, with the
rationale “ship a small, reliable core first; add complexity only when proven
necessary.”

That non-goal is real and this plan does not pretend otherwise.
The case for revisiting it rests on §1.5 principle 6, “Progressive enhancement: core
works standalone, bridges/UI are optional layers,” and on what has since shipped:

- The watch layer now provides an additive-only, provider-neutral change report with a
  resume tip. Before it existed, a live UI would have had to invent its own change
  detection.
- `issueMatchesSharedFilters` and `readyIssueIds` were extracted specifically so that
  more than one surface could share list semantics.
  A second consumer is the test of whether that extraction was worth doing.
- The bead graph in this repository alone is past 1,300 issues with three levels of
  hierarchy. Reading that in a terminal is workable for an agent and awkward for a human.

The honest framing is that §1.6 should be amended rather than quietly ignored.
This plan proposes changing “TUI/GUI interfaces” to explicitly permit one optional,
loopback-only, read-first view, and to keep everything else in that bullet deferred.
**That amendment is a decision for the release owner and is listed as an open question,
not assumed.**

### Prior art: Metabrowser

`github.com/jlevy/metabrowser` is a mature local-server-plus-browser tool with reliable
live updates. Four patterns there are directly applicable and are adopted below.

1. **The domain cursor is the SSE event id.** Metabrowser’s `sse.py` uses the JSONL byte
   offset as the event id, so an automatic `EventSource` reconnect resumes from the last
   acknowledged record through `Last-Event-ID`. tbd already has the equivalent cursor:
   the report’s `tip`. Using it as the event id makes browser reconnect use the same
   resume mechanism as an agent restarting `tbd watch --since`.
2. **Two tiers, coarse and focused.** Metabrowser polls a cheap whole-tree activity
   endpoint and reserves SSE push for the view the user is actually looking at.
   The analogue is a coarse `--all` watch for the graph plus per-row body refresh only
   for expanded rows.
3. **Bounded frames.** A per-batch byte cap prevents a burst from producing one enormous
   frame, plus heartbeat comments on a ~10s cadence to keep intermediaries from dropping
   idle streams.
4. **Change is animated, and motion is optional.** A 900ms flash-in on changed rows, a
   320ms collapse on removal, and a `prefers-reduced-motion` block that drops
   `animation-duration` to 1ms so the color context survives without movement.

## Design

### Layering

`tbd web` is a CLI Layer command in the sense of tbd-design.md §1.7. It reads through
the File Layer and observes the Git Layer through the watch module.
It introduces no fourth layer and no new persistent state.

```
  browser (vanilla, no build step)
      │  HTTP + SSE, loopback only
  ┌───┴──────────────────────────────────────────┐
  │ tbd web                                       │  CLI Layer
  │   query  → shared issue-query module          │
  │   liveness → watch module (report + tip)      │
  └───┬───────────────────────┬───────────────────┘
      │                       │
  File Layer               Git Layer
  listIssues,              watchForIssueChanges,
  loadDataContext          sync --pull
```

### The shared query module

This is the core of the proposal and the part with value independent of the UI.

`ListHandler.filterIssues` and `ListHandler.sortIssues` are private methods on a command
class. `tbd ready` has its own path.
`changes` and `watch` share only the label, spec, and status predicate.
A fifth consumer would make five implementations that must agree.

Extract `src/lib/issue-query.ts`:

```ts
export interface IssueQuery {
  status: IssueStatusType | null;
  all: boolean;
  type: IssueKindType | null;
  priority: string | null;
  assignee: string | null;
  labels: readonly string[];
  parent: string | null;
  spec: string | null;
  deferred: boolean;
  ready: boolean;
  sort: 'priority' | 'created' | 'updated';
  limit: string | null;
}

export function selectIssues(issues, query, context): Issue[];
export function describeQuery(query): string;   // the equivalent `tbd list` invocation
```

`list` and `ready` are refactored onto it with no behavior change, covered by the
existing suites plus the tryscript transcripts.
`web` then consumes the same function, and `describeQuery` is what the page displays.

This refactor is worth doing whether or not `tbd web` ships, and it is the same move PR
\#205 already made for `issueMatchesSharedFilters`. It is therefore Phase 1 and is
independently mergeable.

The same problem exists in two more commands, and one of them is already fixed:

- **`tbd stats`** had its whole aggregation inline in `StatsHandler.run()`, interleaved
  with column rendering.
  It is now `src/lib/issue-stats.ts` exporting `computeIssueStats(issues)` plus the
  `STATUS_ORDER` / `KIND_ORDER` / `PRIORITY_LABELS` constants and, importantly, the
  single definition of `ACTIVE_STATUSES`. `stats.ts` is refactored onto it with
  byte-identical output, and the viewer renders the same object.
  This is done and is the model for the `issue-query` extraction.
- **`tbd status`** is different in kind and should not be extracted wholesale.
  Its `StatusData` mixes served facts (sync branch, prefix, worktree health, workspaces)
  with CLI-shaped ones (agent-integration detection, pre-init Beads discovery).
  Its building blocks are already reusable: `loadDataContext`, `checkWorktreeHealth`,
  `listWorkspaces`. The viewer composes those directly into a smaller `RepoStatus`. If a
  future consumer needs the full picture, extract `collectStatusData()` then; forcing it
  now would drag agent-integration probing into a web server for no benefit.

### Hierarchy

Tree ordering reuses `buildIssueTree`. Rendering does not reuse `renderIssueTree`, which
emits ANSI text; the server sends each row’s depth and guide prefix and the browser
draws it.

`tbd-5hh1` must be fixed first.
`renderTreeNode` currently emits `connector + lineWithoutPrefix`, dropping the ancestor
prefix, so grandchildren render at depth 1 in `tbd list --pretty`. Until that is fixed
the CLI and the page disagree about what the hierarchy looks like, which is exactly the
drift this plan exists to prevent.
The fix is `prefix + connector + lineWithoutPrefix` plus a depth-3 golden test.

### Data flow and performance

Reads are in-process.
`loadDataContext` plus `listIssues` is the path `tbd list` already takes, so a refresh
costs one directory read rather than a subprocess.
The spike loads this repository’s 1,300+ beads in well under the §1.4 budget, and the
same call is what a wake triggers.

Payload shape matters more than raw speed:

- The table receives light rows only: ids, title, status, kind, priority, labels, spec,
  assignee, readiness, and the tree prefix.
  Descriptions and notes are excluded.
- Bodies are served per bead on demand from the in-memory snapshot, so an open row costs
  one small request and a graph of long descriptions never inflates the table payload.
- SSE frames carry watcher state only: tip, changed ids, wake count, phase, and the
  report. Browsers re-query the board with their own filters.
  Frame size is therefore independent of graph size.
- Filtering runs server-side so semantics come from the shared module.
  On loopback this is sub-millisecond and keystroke-responsive.

### Liveness

Two paths, kept separate and labelled distinctly because they answer different
questions.

**Remote.** A blocking `tbd watch --all --json --since <tip>`. On exit 0 the server runs
`tbd sync --issues --pull`, re-reads, and pushes.
The report’s `tip` becomes the next `--since`, so no window is dropped, and it is also
the SSE event id so a browser reconnect resumes the same way.
Exit 3 is a normal recycle.
Exit 1 backs off.

**Local.** `fs.watch` over the hidden sync worktree’s issues directory, debounced, for
edits made in this checkout before anyone publishes them.
This is the only part with no CLI analogue, because `tbd watch` observes the remote
only.

A pull and the viewer’s own writes touch the same files a local edit does, and their
filesystem events can outlive the operation that caused them.
Attribution is therefore by observed state difference, not by timing.

Whether the watch runs in-process or as a child process is an open question.
`watchForIssueChanges` currently accepts no `AbortSignal`, so an in-process watcher
cannot be cancelled without killing the process.
Adding one is small and would let `tbd web` drop the child entirely.

### Writes

Off by default under `--repo`, on under `--demo`. When enabled, limited to status and
notes on a single bead, and routed through the CLI rather than the file layer so they
inherit its validation, locking, and mapping.
`loadDataContext` deliberately does not take the data-sync lock for reads; an in-process
write path would have to.

### CLI surface

```bash
tbd web [--port <n>] [--open] [--read-only] [--interval <seconds>]
```

Binding is `127.0.0.1` only, and there is deliberately no flag to change that.

`tbd web` is a long-running foreground command, which is unusual for this CLI, so it
follows the existing conventions rather than inventing server-specific ones.
Per `typescript-cli-tool-rules`:

- **`BaseCommand`, not a bare action.** A `WebHandler extends BaseCommand` receives the
  typed `CommandContext` and `OutputManager`; the Commander action only instantiates it.
- **All output through `OutputManager`.** The startup descriptor is data on stdout;
  progress, warnings, and wake diagnostics are stderr.
  No raw `console.log`, no hardcoded ANSI. Colors come from `output.getColors()`, icons
  from the shared `ICONS` constant.
- **`--json` emits a descriptor rather than being rejected.**
  `{"url", "port", "pid", "repo", "syncBranch"}` on stdout at startup, then the server
  runs. That is more useful to an agent than a usage error and keeps §4.12’s “data to
  stdout” contract intact.
- **`--open` is a positive flag defaulting to false.** Deliberately not `--no-open`:
  Commander sets `options.open = false` for a negated flag and never sets `noOpen`,
  which is a standing footgun.
  A CLI that might run in CI or under an agent should also not launch a browser unless
  asked.
- **Enum-like options use `Option().choices()`** so bad input fails fast with exit 2.
- **Exit codes come from the shared `exit-codes.ts`** that PR #205 centralized.
  Clean shutdown is 0, usage error 2, operational failure 1, and Ctrl+C is 130. Since
  Ctrl+C is the normal way to stop a server, 130 on the ordinary path is worth stating
  explicitly rather than discovering.
- **`--dry-run` resolves the port and repo, prints what it would serve, and exits 0**
  without binding.

### Server engineering

Minimal, fast to start, and cheap when unused.

- **No dependency.** `node:http` plus a single static page.
  No framework, no bundler, no build step for the client.
  This keeps the command inside the 14-day cool-off rules in `SUPPLY-CHAIN-SECURITY.md`
  by having nothing to cool off.
- **Lazy module load.** The server implementation is behind a dynamic `import()` inside
  the action handler, so `tbd list` and `tbd --help` never parse it.
  A UI command must not regress CLI startup time for everyone who does not use it.
- **One in-memory snapshot.** Loaded once at startup and replaced on a wake.
  Queries run against it, so no request touches the filesystem.
- **SSE backpressure.** `response.write()` returning false, or a rising
  `writableLength`, means a slow client.
  Drop that client rather than buffering without bound; the browser reconnects and
  resumes from `Last-Event-ID`.
- **Bounded frames and heartbeats**, following metabrowser: a per-frame byte cap and a
  comment heartbeat inside the usual 30 to 60 second idle-timeout window.
- **Timers `unref()`'d** so the heartbeat never holds the process open.
- **Shutdown is bounded.** `closeAllConnections()` then a short race against a timeout,
  because idle keep-alive sockets otherwise keep `close()` pending for seconds.
  The spike hit exactly this and stranded temporary directories until it was fixed.
- **`EADDRINUSE` is an actionable error**, naming the port and suggesting `--port 0` for
  an ephemeral one, not a raw stack trace.
- **Untrusted input is validated before it reaches a subprocess argument.** Bead ids
  from query strings are matched against the public-id shape, so a value like `--help`
  cannot become a flag.

## Implementation Plan

Phase 1 is independently valuable and independently mergeable.
Phase 2 depends on the §1.6 amendment being accepted.

### Phase 1: Shared query semantics and hierarchy correctness

- [ ] Fix `tbd-5hh1`: ancestor prefix in `renderTreeNode`, plus a depth-3 golden test.
- [x] Extract `src/lib/issue-stats.ts` with `computeIssueStats`; refactor `tbd stats`
  onto it with identical output.
  Done in the spike.
- [ ] Extract `src/lib/issue-query.ts` with `selectIssues` and `describeQuery`.
- [ ] Refactor `list` and `ready` onto it; assert no behavior change via the existing
  suites and tryscript transcripts.
- [ ] Add an `AbortSignal` to `watchForIssueChanges` and cover cancellation.
- [ ] Fix `tbd-q5c7` so `--json` surfaces never emit a human banner on stdout, since the
  page and any other machine consumer depend on it.

### Phase 2: The command

- [ ] `tbd web` command as a `BaseCommand` handler: loopback bind, `--port`, `--open`,
  `--read-only`, `--interval`, `--json` descriptor, `--dry-run`, lazy server import.
- [ ] Board endpoint over `selectIssues`, returning light rows plus `describeQuery`.
- [ ] Per-bead body endpoint served from the in-memory snapshot.
- [ ] SSE stream with the tip as event id, `Last-Event-ID` resume, heartbeats, and
  bounded frames.
- [ ] Page: tree and flat modes, CLI-named filters, expandable bodies with live refresh,
  per-field deltas including text hunks, event log.
- [ ] Flash-in on change, collapse on removal, `prefers-reduced-motion` honored.
- [ ] Tryscript coverage for the command surface; unit coverage for query translation
  and SSE framing.

## Testing Strategy

- **Query parity is the load-bearing test.** Property-style comparison asserting that
  for a corpus of queries, `selectIssues` returns exactly what the current `list` and
  `ready` filters return.
  This is what makes the refactor safe.
- **Aggregate parity**: `tbd stats --json` and the served stats object must be
  byte-equal for the same repository.
  Already verified by hand against the 1,312-bead graph here; worth an assertion so it
  stays true.
- **Hierarchy**: depth-3 golden test for `--pretty`, and a test that the server’s row
  order matches `buildIssueTree` for the same input.
- **Liveness**: extend the existing two-clone smoke so a headless client consumes the
  SSE stream, verifying a wake arrives, the tip advances, and `Last-Event-ID` resume
  delivers a change that landed while disconnected.
- **Payload bounds**: assert table responses carry no description or notes text, and
  that frame size does not grow with graph size.
- **Performance**: reuse the existing 5,000-issue fixture; assert board response time
  against the §1.4 budget.
- **Isolation**: reuse the release-smoke assertions.
  Running `tbd web` must leave the caller worktree, sync refs, `FETCH_HEAD`, hidden
  worktree, and lock untouched except for the pull it performs on a wake.
- **Security**: assert the listener binds loopback only, that writes are refused without
  the flag, and that bead ids are validated before reaching a subprocess argument.
- **CLI conventions**: assert stdout carries only the descriptor and diagnostics go to
  stderr, that `--dry-run` binds nothing, that a bad `--port` exits 2, that `EADDRINUSE`
  exits 1 with an actionable message, and that Ctrl+C exits 130.
- **Startup cost**: assert that adding the command does not measurably change
  `tbd --help` or `tbd list` startup time, which is what the lazy import exists to
  protect.

## Rollout Plan

Additive and opt-in, with no schema, config, format, or dependency change.
Repositories that never invoke `tbd web` see no new behavior.

Phase 1 ships as a normal refactor with no user-visible change.
Phase 2 ships behind documentation that describes it as a local view, not a service.
Rollback is removing the command; no data migration exists to undo.

## Open Questions

- Does the release owner accept amending tbd-design.md §1.6 to permit one optional,
  loopback-only, read-first view?
  Everything in Phase 2 depends on this.
  Phase 1 does not.
- In-process watch with an `AbortSignal`, or keep the child process?
  The child proves the CLI exit-code contract on every wake, which has real diagnostic
  value; in-process is cleaner and cheaper.
- Should the write path exist at all in v1? Read-only is easier to defend and a narrow
  status edit is what makes the page feel like a tool rather than a report.
- Does `tbd web` belong in core, or as a separate optional package that depends on tbd?
  A separate package keeps core’s dependency surface and non-goals intact, at the cost
  of release coordination and a second install step.
- Is `--all` the right default watch selection for a UI? It is the most useful and the
  most expensive; a large team on a shared remote may want the page to watch a narrower
  selection.

## References

- `plan-2026-07-19-bead-watch-and-external-sync.md` — the watch contract this builds on
- `valid-2026-08-09-bead-watch-release.md` — isolation and resource assertions to reuse
- `packages/tbd/docs/tbd-design.md` §1.5, §1.6, §1.7, §4.10, §4.12
- `packages/tbd/src/lib/issue-selection.ts` — the existing shared predicates
- `packages/tbd/src/cli/lib/tree-view.ts` — `buildIssueTree` and the `tbd-5hh1` defect
- `packages/tbd/scripts/bead-web.ts`, `bead-web.html` — the working spike
- `github.com/jlevy/metabrowser` — `src/metabrowser/sse.py` for cursor-as-event-id and
  bounded frames; `src/metabrowser/static/styles.css` for flash and reduced-motion
- Beads: `tbd-5hh1` (tree depth), `tbd-q5c7` (stdout JSON contract), `tbd-w5xi`
  (`--due`)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
