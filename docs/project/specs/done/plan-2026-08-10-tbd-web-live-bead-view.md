---
title: "tbd web: Live Bead View"
description: An optional local web view over the shared bead worktree, updated from local filesystem activity and sharing the CLI's query semantics
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: `tbd web` — Live Bead View

**Date:** 2026-08-10 (last updated 2026-08-13)

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Released in get-tbd v0.5.0 through PRs #207 and #209

## Overview

A single optional command, `tbd web`, serves a loopback-only page that renders the local
bead graph and updates itself when the shared hidden data-sync worktree changes.
It is a read-only view over the same state every ordinary `tbd` command reads and
writes. It never contacts a remote.
`tbd sync` remains the one explicit operation that fetches, merges, and publishes bead
state; once that command changes the local worktree, the running page observes the
result immediately.

The governing constraint is that the browser must not become a second, drifting
implementation of `tbd list`. Every filter the UI offers is a CLI flag, evaluated by the
CLI’s own predicates, and each response carries the equivalent command line.

The delivery vehicle is PR #207, and its bar is explicit: **it merges once, when
`tbd web` is production-ready, and not before.** A disposable server and page proved the
interaction in Phase 1. The production command now replaces that spike with typed,
tested, packaged modules and the spike files have been retired.
This document is the implementation record at file and function level.
The final owner-directed revision removes the web-only remote synchronization contract
before the external CI and merge-state gate is repeated.

## Goals

- One optional command that renders local bead state and stays current without a manual
  browser refresh.
- One synchronization contract across CLI and UI: only `tbd sync` contacts the remote;
  `tbd web` reflects whatever state local `tbd` commands make visible.
- Exactly one tabular-query implementation shared by `list`, `ready`, and `web`, while
  `changes` and `watch` continue to share their relevant label/spec/status predicates.
  The UI cannot evaluate a CLI-shaped filter differently.
- Every view is reproducible from the terminal.
  The page always shows the `tbd list` invocation equivalent to what is on screen.
- No new runtime dependency, no schema change, no `tbd_format` bump, and no behavior
  change for repositories that never run the command.
- Legible local change: when state moves, the affected rows say so, including which
  fields changed and how.
- Fast on a real graph.
  Interaction stays immediate at 5,000 to 10,000 issues, matching the performance goal
  in tbd-design.md §1.4.

## Non-Goals

- No general-purpose issue-tracker UI. No boards, no drag-and-drop, no charts, no saved
  views, no multi-repo dashboard.
- No non-loopback bind, no authentication, no multi-user session model.
  A remote-reachable surface is a separate proposal with its own security review.
- No daemon. The server lives and dies with the foreground command.
- No remote polling, implicit fetch, implicit merge, or background sync.
  The standalone `tbd watch` and `tbd sync` commands keep their existing remote
  semantics.
- No write surface at all in v1 (see Writes): every mutation stays in the CLI. The
  spike’s narrow flag-gated edit proved the path and then was cut from scope.
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
**Decided 2026-08-10: the project owner directed productionization of `tbd web` as a
core command, so the amendment is in scope for this PR** (Phase 5): §1.6 changes to
permit exactly one optional, loopback-only, read-first web view, keeping everything else
in that bullet deferred.
The amendment text lands in the PR diff, where the owner reviews it like any other
change.

### Prior art: Metabrowser

`github.com/jlevy/metabrowser` is our own mature local-server-plus-browser tool (Python,
but the same shape: a minimal embedded server, one page, live updates).
It is the reference implementation for this plan in four wire-level patterns listed
here, and its serve-mode lifecycle (readiness-gated auto-open, port-range search,
SSE-aware shutdown with clean signal handling) and client QA practices (jsdom-free
stubbed-window behavior tests, lint and typecheck floors) are adopted in the CLI
surface, Server engineering, Client build and packaging, and Testing sections.

1. **Native observation with a bounded reconciliation path.** Metabrowser selects a
   native filesystem watcher on ordinary local filesystems and cheap periodic metadata
   reconciliation on filesystems where native notification is unreliable.
   tbd does not need its filesystem-type dependency or platform branches: Node’s core
   `fs.watch` maps to the native macOS/Linux/Windows facilities, while a one-second stat
   marker over the relevant worktree directories and local ref repairs a dropped
   notification without reloading the whole graph every second.
2. **Two tiers, coarse and focused.** Filesystem activity is only a cheap signal.
   The server reloads one in-memory graph after a signal and reserves per-row body
   requests for expanded rows.
3. **Bounded frames.** A per-batch byte cap prevents a burst from producing one enormous
   frame, plus heartbeat comments on a 20-second cadence to keep intermediaries from
   dropping idle streams.
4. **Change is animated, and motion is optional.** A 900ms flash-in on changed rows, a
   320ms collapse on removal, and a `prefers-reduced-motion` block that drops
   `animation-duration` to 1ms so the color context survives without movement.

## Design

### Layering

`tbd web` is a CLI Layer command in the sense of tbd-design.md §1.7. It reads through
the File Layer and observes the shared data-sync worktree through a local observer.
It introduces no fourth layer and no new persistent state.

```
  browser (strictly-linted TS, built by tsdown; see Client build and packaging)
      │  HTTP + SSE, loopback only
  ┌───┴──────────────────────────────────────────┐
  │ tbd web                                       │  CLI Layer
  │   query  → shared issue-query module          │
  │   liveness → local observer (fs event + marker)│
  └───┬───────────────────────────────────────────┘
      │
  File Layer
  listIssues, loadDataContext

  Explicit operator action: tbd sync → shared worktree → local observer
```

### The shared query module

This is the core of the proposal and the part with value independent of the UI.

`ListHandler.filterIssues` and `ListHandler.sortIssues` are private methods on a command
class. `tbd ready` has its own path.
`changes` and `watch` share only the label, spec, and status predicate.
A fifth consumer would make five implementations that must agree.

Extract `src/lib/issue-query.ts` — precise signatures live in the module map below
(`selectIssues(issues, query)` and `describeQuery(query)` over a fully-parsed
`IssueQuery` whose id fields are already resolved to internal ids by the caller).

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
same call is what a local change triggers.

Payload shape matters more than raw speed:

- The table receives light rows only: ids, title, status, kind, priority, labels, spec,
  assignee, readiness, and the tree prefix.
  Descriptions and notes are excluded.
- Each board response carries conditional Status, Type, and Priority facets plus at most
  32 label facets. Counts apply search and all other active dimensions rather than global
  standalone totals; unselected zero-count values are omitted.
  Label search queries the complete vocabulary before the response cap, so lower-ranked
  labels remain reachable.
  Label candidates additionally apply the current repeated-label intersection, retaining
  selected values for removal and preserving CLI `--label` AND semantics.
- Bodies are served per bead on demand from the in-memory snapshot, so an open row costs
  one small request and a graph of long descriptions never inflates the table payload.
- SSE frames carry local-observer state only: changed ids, update count, phase, mode,
  error, and the latest bounded local delta.
  Browsers re-query the board with their own filters; that response carries the
  canonical complete movement state at the same `stateVersion` if a frame had to omit
  detail or ids to stay bounded.
  Motion therefore remains complete after the board refresh, while field-level detail is
  limited to 100 changed beads and 256 KiB with oversized values summarized.
  Event-frame size is independent of graph size.
- Filtering runs server-side so semantics come from the shared module.
  On loopback this is sub-millisecond and keystroke-responsive.
- Collapsed titles use at most four lines and restore their full text on expansion.
  Updated values use compact sans relative ages with exact monospace timestamp tooltips.
  The default is Pretty with Updated descending then Priority ascending.
  Every displayed data column is an ordered sort key: the latest click becomes primary,
  the prior primary is the sole tie-breaker, and sorting never clears Pretty.
  Pretty sorts outermost visible parent groups only; Updated rolls up the latest
  timestamp in each complete visible subtree for every parent kind, while children keep
  official `child_order_hints` order.
  Each non-root browser row renders one `└──` elbow at its hierarchy indentation;
  ancestor levels are spaces, never vertical bars, and sibling position never selects a
  tee. Flat mode applies the stack globally, and Reset restores the default sort stack
  without changing Pretty.
  The equivalent-command tooltip names browser-only ordering that the adjacent CLI
  command does not reproduce.
  Filtered-out ancestors are never reinserted; matching descendants become roots,
  exactly as in `tbd list --pretty`.
- Expanded updated beads show 80-character middle-ellipsis previews for each scalar
  before/after value while Copy retains bounded full data.
  Before is muted, after is normal text, and created beads suppress redundant
  null-to-current-value deltas.
- The server returns at most 10,000 light rows while preserving the unsliced match
  count. The browser renders the response in 5,000-row pages, so all served rows remain
  reachable without making every refresh lay out a six-figure DOM tree.
  Sticky and end-of-page controls navigate the pages and return the viewport to the
  first row.
- Bulk expansion is available only when the visible page has 100 rows or fewer.
  Individual expansion remains available at every size, but the oldest detail closes
  after 100 remain open.
  Query, sort, display-mode, and page changes close expanded details.
  A live graph update retains an expansion only when the stable internal bead remains in
  the current bounded response; its current display id is resolved before the body
  reload begins. This keeps off-board or obsolete display ids from consuming the detail
  cap. Eight detail requests may be in flight, 200 recent bodies may remain cached, and
  render notifications coalesce to one browser frame.
  A mass deletion animates at most 100 ghost rows instead of bypassing the steady-state
  page bound.

The limits are independent and come from measured costs rather than one arbitrary row
number. The server path is cheap at 10,000 representative issues: 13–30 ms to load or
refresh the in-memory snapshot, 36–115 ms to build the response, and 2.47 MiB serialized
on the review machine.
The high end is the full parallel test-suite run; the isolated focused case supplied the
low end. The final concurrency gate measured 16.44 ms initial load, 29.39 ms one-change
refresh, and 53.71 ms response construction.
The final facet-and-sort slice measured a 10,001-issue, 2.85 MiB bounded response at
38.70 ms and a two-column composition over the same board at 13.63 ms.
That fixture injects already-parsed issues, so it is not presented as a disk benchmark.
A separate one-off check on 2026-08-11 wrote 10,000 representative files through
production `writeIssue` and then read them twice through production `listIssues`; the
warm parse took 1.31 seconds on the review machine.
Fixture creation took 30.7 seconds, which is why CI layers the existing 1,000-file
storage regression, the 10,001-item board boundary, and the browser measurements instead
of rebuilding a 10,000-file store on every run.
The result puts the uncommon 10,000-file boundary near the requested one-second update
target while keeping the more plausible 4,000–5,000 range comfortably below it on the
same approximately linear read path.

The original full-DOM client was the limiting browser resource:

| Served rows | Full-DOM nodes | Full-DOM paint-ready | Paged DOM nodes | Paged paint-ready |
| ---: | ---: | ---: | ---: | ---: |
| 4,000 | 42,861 | 0.71–0.88 s | 10,870 | 0.17–0.18 s |
| 5,000 | 53,528 | 0.86–1.00 s | 10,870 | 0.18–0.20 s |
| 10,000 | 106,861 | 1.69–1.83 s | 10,870 | 0.19–0.20 s |

Those figures are three warm Chromium navigations after one warm-up of the stitched
production page over loopback on 2026-08-11. Network transfer was 2–15 ms; style,
layout, and paint dominated.
Expanding all 10,000 rows in the old client created 20,000 table rows and 156,861 DOM
nodes in 3.89 seconds before any delayed detail response completed, after which each
completion would have triggered another full-table render.
This is why 10,000 is the response ceiling, not the render window or bulk-expansion
allowance. A 5,000 ceiling would still be plausible in ordinary projects and would not
address the browser bottleneck.

The design-system refinement intentionally adds semantic text wrappers and accessible
copy controls, so the earlier 10,870-node paged figure is a baseline rather than a
permanent node budget.
A fresh 2026-08-12 measurement of the current production page rendered 1,000 rows from a
1,499-bead repository in 18,640 total elements, including 1,015 copy buttons and zero
inline SVG descendants.
Three automated active-to-all filter transactions reached the settled 1,000-row DOM in
282–315 ms end to end, including browser-control overhead and a 20 ms postcondition
cushion. The copy primitive keeps one real focusable button per literal but renders its
normal and checked states as CSS masks and delegates events at the document: compared
with the first inline-SVG implementation, this sample avoids 3,045 SVG elements and
replaces roughly 4,060 per-target listeners with three shared listeners.

The pagination threshold was then reconsidered from first principles against the
production bundle rather than retained at 1,000 by convention.
A separate loopback fixture exercised the complete stitched UI with long titles,
semantic states, labels, quiet derived-ready markers, copy controls, and nested pretty
prefixes. Ready remains the exact open + unassigned + unblocked `tbd ready` predicate;
the filter is a primary work-discovery control, while the row marker is deliberately
unboxed so it cannot be mistaken for a user label:

| Visible rows | Total elements | Copy buttons | Paint-ready navigation |
| ---: | ---: | ---: | ---: |
| 5,000 | 93,323 | 5,014 | 1.71–2.55 s |
| 10,000 | 186,380 | 10,014 | 2.81–5.50 s |

These are three to four warm Chromium navigations on 2026-08-12, each requiring the last
row to exist plus a 20 ms postcondition cushion.
The near-linear node count and the larger repeat-run variance at 10,000 show that
garbage collection and layout—not API transfer—become the boundary.
Five thousand is therefore the largest clean default: ordinary repositories through
5,000 beads avoid pagination, while the uncommon 5,001–10,000 range pays one page
transition instead of forcing every local update to replace roughly 186,000 elements.
The 1,000-row measurement remains the normal-scale latency reference, not the page
limit.
The working set is bounded by the 5,000-row page—not the 10,000-row response—while
retaining keyboard and screen-reader access.

### Liveness

There is one path: local observation.
`LocalObserver` recursively watches the hidden data-sync directory with Node core
`fs.watch`, which uses native OS notification without adding a platform dependency.
Events are trailing-debounced so an atomic-write or sync burst produces one serialized
`BoardState.reload()` instead of one reload per file.

Native watcher queues can overflow and some filesystems do not provide reliable
recursive events.
A one-second reconciliation loop therefore reads a constant-size marker
made from metadata for the issues directory, mapping directory, project config,
workspace metadata, and local sync-branch ref, plus the bounded persistent writer-epoch
token.
It reloads the board only when that marker changes; it never scans the issue files
or re-runs the full query on an unchanged tick.
If `fs.watch` is unavailable, the marker becomes the transparent fallback.
If marker reads fail, native events remain active.
The UI exposes the active mode and only enters an error phase if neither path can
observe state or a reload itself fails.

The startup sequence reads a marker, installs the native watcher, and performs one
serialized reconciliation reload.
This closes the gap between the server’s initial snapshot and watcher installation.
Each later reload computes movement from the actual before/after `id:version` snapshots
(including display-ID mapping changes), not from event timing, so duplicate/coalesced
events are harmless.
Shutdown closes the watcher, cancels debounce, retry, and reconciliation timers, and
fences off late completion callbacks before the server’s bounded wait expires.

Every observer process carries a fresh instance id and a monotonic `stateVersion` in
board and event state.
The state version orders metadata-only publications as well as graph movement;
`dataVersion` continues to identify bead-graph movement specifically.
The client uses the instance id with both counters, so an EventSource reconnect after a
server restart accepts the new process’s lower counters and refreshes instead of waiting
for them to catch up.
A board response at the same state version may replace a bounded event frame with the
canonical complete state, while an older response cannot roll metadata back.
Repository-status-only changes are published without pretending the bead graph moved.

No code in this path calls `watchForIssueChanges`, `git fetch`, or a network API. The
earlier in-process sync extraction and watch-cancellation plumbing were removed when
their only web caller disappeared; `sync.ts`, `bead-watch.ts`, and `git.ts` retain their
pre-PR contracts. A user who wants remote state runs the same `tbd sync` command they
would without the UI. Its file/ref updates are then native local events, so the page
redraws without a browser refresh.
This preserves one CLI/UI contract and makes local-only or offline use unsurprising.

### Concurrency contract

The implementation must satisfy the ownership, stable-snapshot, coalescing, transport,
client-ordering, and shutdown invariants in `packages/tbd/docs/tbd-design.md` §4.15,
“Concurrency and Snapshot Safety.”
In particular, a reload stages a candidate and publishes it only when the same
persistent quiescent writer epoch brackets the entire read and the shared writer lock is
absent at both boundaries.
The metadata marker is a missed-event trigger and an additional instability check, not
the transaction proof.
Startup context preparation initializes, migrates, or repairs under the central shared
lock wrapper and establishes the epoch before the listener and observer exist; the
long-running reload path never takes or waits for that lock.
One active reload plus one pending slot bounds event bursts; an unstable candidate
leaves both the accepted snapshot and reconciliation marker unchanged so a later retry
cannot be suppressed.

The verification matrix must force the relevant interleavings rather than infer safety
from ordinary timing: overlapping writer transactions, a writer that starts and ends
during a read, concurrent native and reconciliation triggers, events arriving during an
active reload, SSE attach/close during publication, stale board and detail responses,
observer restart with lower counters, and shutdown with work in flight.
Assertions cover complete old-or-new snapshots, aggregate final-state convergence,
monotonic client adoption, bounded work, isolated slow clients, and idempotent teardown.
The contract does not require one delivery per filesystem event or expose intermediate
writer state.

### Writes

**v1 ships read-only.** The spike’s flag-gated status/notes edit proved the write path
works, but shipping it means owning a mutation endpoint’s security surface (Origin
checks are necessary, not sufficient), an in-process write path that must take the
data-sync lock `loadDataContext` deliberately skips for reads, and idempotency questions
the CLI already answers.
None of that earns its keep in v1: edits stay in the CLI, one keystroke away.
The write endpoint does not ship; the code path is removed, not flag-hidden, so the
production server has no mutation route to audit.
Revisit as its own proposal if real usage asks for it.

### CLI surface

```bash
tbd web [path] [--port <n>] [--open]
```

Binding is `127.0.0.1` only, and there is deliberately no flag to change that.

`path` may identify an initialized repository or any directory inside one and is
resolved relative to the caller before ordinary repository discovery.
This makes the viewer usable from an unrelated working directory without changing its
data model. An initialized repository with zero beads is a valid empty board.
A missing path is a usage error, while an existing directory without tbd metadata uses
the same `NotInitializedError` contract as other repository commands.

`tbd web` is a long-running foreground command, which is unusual for this CLI, so it
follows the existing conventions rather than inventing server-specific ones.
Per `typescript-cli-tool-rules`:

- **`BaseCommand`, not a bare action.** A `WebHandler extends BaseCommand` receives the
  typed `CommandContext` and `OutputManager`; the Commander action only instantiates it.
- **All output through `OutputManager`.** The startup descriptor is data on stdout;
  progress, warnings, and local-observer diagnostics are stderr.
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
- **`--open` waits for HTTP-OK readiness, not a bare TCP accept.** Metabrowser’s serve
  mode polls the index route (50ms cadence, ~10s ceiling) and opens the browser only on
  a non-error response; on timeout it prints the URL and leaves the browser closed.
  Same discipline here, and a failed `webbrowser`-style launch degrades to printing the
  URL, never to a hard error.
- **Default port starts a bounded search; explicit `--port` pins.** Also from
  metabrowser: with no `--port`, search a small range from the default (7777 up, ~10
  candidates) and serve the first free one, so two repos can run viewers without
  ceremony; exhausting the range is reported as a real problem (an orphaned server), not
  casual contention. An explicit `--port` binds exactly that port and fails with an
  actionable message if taken.
  Either way, the printed URL and the `--json` descriptor carry the port actually bound:
  the printed URL must be the URL that works.
- **Enum-like options use `Option().choices()`** so bad input fails fast with exit 2.
- **Handler exit codes come from the shared `exit-codes.ts`** that PR #205 centralized.
  Clean shutdown is 0, handler validation such as a bad port is 2, operational failure
  is 1, and Ctrl+C is 130. Commander keeps the CLI’s existing exit-1 behavior for an
  unknown option such as the removed `--interval`; the transcript pins that distinction.
  Since Ctrl+C is the normal way to stop a server, 130 on the ordinary path is worth
  stating explicitly rather than discovering.
- **`--dry-run` resolves the port and repo, prints what it would serve, and exits 0**
  without binding.

### Client build and packaging

The spike’s client is ~700 lines of untyped JavaScript inline in one HTML file.
That was right for a disposable instrument and is wrong for a shipped command: client
code must be TypeScript under the same strictTypeChecked lint floor as everything else
in this repo, and the shipped page must land in `dist/` (the package publishes nothing
else). The design keeps the one-toolchain, zero-new-dependency constraint:

- **Source layout**: `src/web/client.ts` (thin DOM glue) plus `src/web/core.ts` (pure
  logic: query-string assembly, command caveat text, phase labels, row classification).
  The split is what makes the client testable without a DOM library: vitest covers
  `core.ts` as plain functions, and the glue stays too thin to hide bugs.
  `index.html` and `styles.css` sit beside them as templates.
- **Type checking**: a `tsconfig.web.json` extending the base config with
  `lib: ["ES2023", "DOM", "DOM.Iterable"]`, including only `src/web`; the main tsconfig
  excludes `src/web` so DOM globals never leak into server code.
  The `typecheck` script runs both projects; eslint’s `projectService` resolves each
  file to its own project, so the existing flat config applies the full type-aware rule
  set to the client with no new eslint configuration.
- **Bundling**: one more tsdown config entry, `platform: 'browser'`, `format: ['iife']`,
  `dts: false`, emitting `dist/web/client.iife.js`. Same toolchain, no Vite or other
  frontend stack — a second bundler would be a supply-chain surface the page cannot
  justify.
- **Stitching**: the postbuild step (alongside `copy-docs.mjs`) inlines
  `dist/web/client.iife.js` and `src/web/styles.css` at the `/*__TBD_WEB_SCRIPT__*/` and
  `/*__TBD_WEB_STYLES__*/` markers, then writes `dist/web/index.html` as a single
  self-contained artifact.
  The serve path stays one file read, the artifact is auditable as one document, and a
  strict same-origin CSP remains possible because the page makes no external requests.
- **Design-system enforcement**: `bead-web-css.test.ts` retargets `src/web/styles.css`,
  where the token rules are simpler to assert than inside HTML, and keeps its current
  assertions unchanged.
- **QA parity with metabrowser, then past it.** Metabrowser is the reference point for
  client QA in a sibling project, and this plan must be at least as strong: it lints all
  client JS with Biome’s recommended preset and typechecks it with `tsc --checkJs`
  strict plus DOM libs — but its largest client files (`app.js`, `charts.js`, and
  others) sit on the typecheck exclude list.
  Here the client is TypeScript from the start, so 100% of it passes the repo’s
  type-aware `strictTypeChecked` eslint floor and strict tsc with no exclusion list; the
  check is stronger and has no carve-outs.
- **Behavior tests without jsdom, metabrowser’s way.** Its DOM tests run under plain
  Node with a stubbed `window`/`fetch` because the modules under test deliberately “own
  no EventSource and no DOM” — the contracts covered are connect-then-fetch ordering,
  delta buffering and replay, and retry without data loss.
  Adopt the same rule as a design constraint, not a test trick: `src/web/core.ts` takes
  `fetch`, `EventSource`, and storage as injected interfaces, so vitest covers the SSE
  current-state recovery, update coalescing, and query-string contracts with stubs, and
  the un-injected DOM glue stays too thin to need a browser.

### Server engineering

Minimal, fast to start, and cheap when unused.

- **No dependency.** `node:http` plus one stitched static page.
  No framework and no second bundler: the client builds through the existing tsdown
  setup (see Client build and packaging), so there is nothing new for the 14-day
  cool-off rules in `SUPPLY-CHAIN-SECURITY.md` to cool off.
  Metabrowser reaches the same posture only as far as Python allows (it must carry
  uvicorn because there is no stdlib ASGI server); Node’s `http` module lets this
  command go all the way to zero.
- **Lazy module load.** The server implementation is behind a dynamic `import()` inside
  the action handler, so `tbd list` and `tbd --help` never parse it.
  A UI command must not regress CLI startup time for everyone who does not use it.
- **One in-memory snapshot.** Loaded once at startup and replaced after a local update.
  Queries run against it, so no request touches the filesystem.
- **SSE backpressure.** A false `response.write()` return only means Node crossed its
  implementation high-water mark, which varies by supported Node release; it is not by
  itself a failed peer.
  Track `writableLength` against an explicit per-client byte ceiling and drop only when
  the next frame would exceed that ceiling.
  The browser then reconnects with `Last-Event-ID` when the local tip is available and
  otherwise receives current state.
- **Bounded frames and heartbeats**, following metabrowser: a per-frame byte cap and a
  comment heartbeat inside the usual 30 to 60 second idle-timeout window.
- **Timers `unref()`'d** so the heartbeat never holds the process open.
- **Shutdown is bounded, and signals are handled metabrowser’s way.** Open EventSource
  streams make naive graceful shutdown hang, so the first SIGINT/SIGTERM cancels
  in-flight SSE streams immediately (`closeAllConnections()` raced against a short
  timeout — the spike learned this by stranding temp directories), logs nothing for the
  expected stream cancellations, and exits 130 for Ctrl+C per the exit-code contract.
  A second SIGINT forces immediate exit with teardown noise suppressed entirely: once
  the operator forces exit, no teardown record is actionable.
  Command-scoped handlers start one idempotent shutdown path, remain installed so a
  second signal can force exit, and are removed when the command finishes.
  Every timer is `unref()`'d so nothing holds the process open.
- **Port failures are actionable, per the CLI-surface port policy.** An explicit
  `--port` that is taken names the port and the fix; default-range exhaustion is
  reported as a likely orphaned server rather than retried forever.
  Never a raw `EADDRINUSE` stack trace.
- **Untrusted input is validated before it reaches a subprocess argument.** Bead ids
  from query strings are matched against the public-id shape, so a value like `--help`
  cannot become a flag.

## Module map (file and function level)

The production layout, named so the phases below can reference exact seams.
Signatures are the intended shape; adjust mechanically in review, not structurally.

### Core (Phase 2)

- **`src/lib/issue-query.ts`** (new; pure and node-free, like `issue-selection.ts` and
  `issue-stats.ts`):

  ```ts
  export type IssueSort = 'priority' | 'created' | 'updated';
  export interface IssueQuery {
    status: IssueStatusType | null;
    includeClosed: boolean;          // --all
    kind: IssueKindType | null;      // --type
    priority: number | null;         // parsed by caller via parsePriority
    assignee: string | null;
    labels: readonly string[];
    parentId: InternalIssueId | null; // resolved by caller via resolveToInternalId
    spec: string | null;
    deferred: boolean;
    ready: boolean;
    sort: IssueSort;
    limit: number | null;
  }
  /** Filter + sort (ULID tiebreak) + limit; the single list/ready/web semantics. */
  export function selectIssues(issues: readonly Issue[], query: IssueQuery): Issue[];
  /** The equivalent CLI invocation, with exactness (tbd ready expresses only --type/--limit). */
  export function describeQuery(query: IssueQuery): { command: string; exact: boolean };
  ```

  `list.ts` keeps flag parsing, id resolution, and rendering; its private
  `filterIssues`/`sortIssues` bodies move here verbatim-then-verified.
  `ready.ts` maps to `{ ready: true, sort: 'priority' }`. Readiness stays in
  `issue-selection.ts` (`readyIssueIds`) and is consumed by `selectIssues` when
  `query.ready`.

- **`src/file/bead-watch.ts`, `src/file/git.ts`, `src/cli/commands/{watch,sync}.ts`**:
  unchanged from `origin/main`. The final local-only design needs no cancellation hook,
  in-process sync helper, or `tbd sync` rewrite.

- **`src/cli/lib/tree-view.ts`**: `renderTreeNode` emits
  `prefix + connector + issueLine` (tbd-5hh1); depth-3 golden test added.

- **`src/cli/lib/output.ts`**: `OutputManager` gains a public `get isJson(): boolean`;
  `docs-sync-output.ts#printDocSyncStatus` returns early under it (tbd-q5c7).

### Server (Phase 3)

- **`src/cli/commands/web.ts`**: Commander definition plus
  `WebHandler extends BaseCommand`. Flags: `--port <n>`, `--open`, `--dry-run`; global
  `--json` emits the startup descriptor `{ url, port, pid, repo, syncBranch }` on
  stdout. The handler validates flags, resolves the repo (`requireInit`, `readConfig`),
  then lazy-imports the server (`await import('../web/server.js')`) so no other command
  pays for it. SIGINT/SIGTERM wiring per the lifecycle rules; exit codes from
  `exit-codes.ts`.
- **`src/cli/web/server.ts`**: `prepareWebContext(repoDir)` performs the one
  repair-capable, epoch-establishing startup transaction before command-scoped signal
  handling; `startWebServer(options: WebServerOptions): Promise<WebServerHandle>`
  receives that context, where the handle is
  `{ port, url, close(), closed: Promise<void> }`. Owns the `node:http` server, port
  policy (`findAvailableLoopbackPort(base, count)` here, mirroring metabrowser’s
  `server_utils.py`), stable initial snapshot retry, readiness self-probe, and bounded
  shutdown.
- **`src/cli/web/board.ts`**: `BoardState` — the in-memory snapshot (`loadDataContext` +
  lock-free prepared-context read + strict `listIssues`), FIFO `reload()` staging a
  candidate between identical quiescent writer epochs, then computing
  `dataVersion`/`movedIds`/`removedIds` and local field deltas by before/after snapshot
  diff with complete motion plus bounded detail, `getObservationPaths()` exposing only
  the constant-size local marker inputs, `computeIssueStats`, the served `RepoStatus`,
  and `buildBoardResponse(params)` translating query strings to `IssueQuery` and calling
  `selectIssues`/`describeQuery` plus the filter-exact tree walk over `buildIssueTree`.
- **`src/file/data-sync-epoch.ts`** + **`src/file/common-dir-layout.ts`**: the central
  shared writer wrapper atomically publishes `active:<uuid>` before a critical section
  and `quiescent:<uuid>` before unlocking.
  Every standard data-sync writer, including `tbd sync` and `doctor --fix`, therefore
  participates without a web-specific write path.
- **`src/cli/web/local-observer.ts`**: `LocalObserver` owns recursive native `fs.watch`,
  trailing debounce, the one-second constant-size metadata marker, one-active plus
  one-pending reload coalescing, bounded deferred/error retry, degraded-mode reporting,
  the observer-local monotonic `stateVersion`, and fenced shutdown.
  It has no network-capable dependency.
- **`src/cli/web/http.ts`**: router with Host/Origin validation, `GET /`,
  `GET /api/board`, `GET /api/bead`, `GET /api/events` (SSE hub: local sync tip as the
  event id when available, bounded replay suffix ending in current state, heartbeats,
  per-client backpressure drop, attach/close race isolation), and `sendJson`. No
  mutation route exists in v1.

### Client (Phase 4)

- **`src/web/core.ts`** (pure; no DOM, no globals): transport-injected store.

  ```ts
  export interface Transport {
    fetchJson(url: string, signal?: AbortSignal): Promise<unknown>;
    openEvents(url: string, onState: (s: unknown) => void, lastEventId?: string): { close(): void };
  }
  export function createClientStore(transport: Transport, onRender: () => void): ClientStore;
  export function buildQueryString(controls: BoardControls): string;
  export function caveatsFor(board: BoardResponse): string[];
  export function deltasValid(watch: ObservationStateView): boolean;  // changeDataVersion gate
  export function phaseLabel(watch: ObservationStateView): { label: string; help: string };
  ```

- **`src/web/client.ts`**: DOM glue only — element lookup, render, event wiring, theme
  chooser; instantiates the store with the real `fetch`/`EventSource`.

- **`src/web/index.html`** + **`src/web/styles.css`**: template with
  `/*__TBD_WEB_STYLES__*/` / `/*__TBD_WEB_SCRIPT__*/` markers; the design-system rules
  live in the CSS.

- **`tsconfig.web.json`**: extends base, `lib: ["ES2023","DOM","DOM.Iterable"]`,
  includes only `src/web`; main `tsconfig.json` excludes `src/web`; the `typecheck`
  script runs both projects.

- **`tsdown.config.ts`**: one added entry — `platform: 'browser'`, `format: ['iife']`,
  `dts: false`, `entry: { 'web/client': 'src/web/client.ts' }`.

- **`scripts/stitch-web.mjs`** (postbuild, beside `copy-docs.mjs`): inlines
  `dist/web/client.iife.js` and `src/web/styles.css` into the template →
  `dist/web/index.html`, the one artifact the server reads.

### Tests (Phases 2–6)

- `tests/issue-query.test.ts` — parity oracle: legacy filter/sort logic captured as a
  test-local oracle, property-style corpus compared against `selectIssues`.
- `tests/tree-view.test.ts` — depth-3 golden (tbd-5hh1).
- `tests/web-board.test.ts` — light rows, shared queries, exact-filter trees and root
  roll-up ordering, movement, metadata-only updates, bounded delta detail, body lookup,
  canonical display-id alphabets, FIFO reloads, writer overlap, unchanged-metadata epoch
  races, repository context changes, and strict candidate rejection.
- `tests/data-sync-epoch.test.ts` — active/quiescent writer ordering, lock lifetime,
  failed critical sections, and corrupt-epoch fail-closed behavior.
- `tests/web-http.test.ts` — GET-only routing, Host/Origin security, detail isolation,
  ref-rewind-safe bounded SSE replay ending in current state, convergence after
  local-ref deletion, frame bounds, explicit queued-byte backpressure, and synchronous
  attach/header/close race isolation.
- `tests/web-local-observer.test.ts` — startup gap closure, native debounce, one-second
  marker reconciliation, one-active/one-pending burst coalescing, deferred/error retry,
  native/reconciliation degradation, metadata-only publication, no reload on unchanged
  ticks, and shutdown at active/late-callback boundaries.
- `tests/web-server.test.ts` — port policy, readiness, idempotent and observer-failure
  tolerant teardown, and the stitched production artifact.
- `tests/web-core.test.ts` — stubbed `Transport`: connect-then-fetch ordering, SSE
  current-state and observer-restart recovery, graph/state-version race ordering,
  canonical same-version board recovery and duplicate-event protection, update
  coalescing, aborted superseded board/detail responses, `deltasValid` gating, and query
  round-trip.
- `tests/cli-web.test.ts` — spawn the built binary as `cli-watch.test.ts` does: bind,
  descriptor shape, port policy (default searches; explicit `--port` conflict exits 1
  actionably), Host/Origin 403s, SIGINT exits 130, no mutation route (POST → 404),
  explicit-sync-only remote integration, and old-snapshot service during a real held
  writer lock.
- `tests/bead-web-css.test.ts` — retargeted to `src/web/styles.css`, assertions kept.
- `tests/cli-web.tryscript.md` — `--help` and `--dry-run` transcripts.
- `performance.test.ts` — 10,001-issue boundary fixture proving the 10,000-row response
  cap, one-change refresh and response-time budgets, and 5 MiB serialized-payload
  budget.
- `scripts/validate-web-package.mjs` — pack/extract/start/fetch/stop proof for the exact
  npm artifact, run in the OS matrix and before release publishing.

## Implementation Plan

Phases are ordered to keep risk early.
Each implementation phase ended with focused tests and the local branch green; Phase 6
records the full local gate and final CI matrix.
The Phase 2 core refactors remain separable in the history even though the owner chose
to land the whole command through one PR.

### Phase 1: Spike (complete)

- [x] Working server + client proving the design end to end, live-verified on this
  repository’s 1,312-bead graph (~500ms load, ~10ms queries).
- [x] `src/lib/issue-stats.ts` extraction with byte-identical `tbd stats` output.
- [x] Review survived: four Bugbot findings fixed and resolved; merged with post-#205
  main; format-marker reconciliation.
- [x] Instrument value banked: five core defects found and filed (tbd-5hh1, tbd-q5c7,
  tbd-w5xi, tbd-zmpo, tbd-pht1).

### Phase 2: Core foundations

- [x] `src/lib/issue-query.ts` per the module map; `list`/`ready` refactored onto it
  (`e5c9360d`). Parity oracle green id-sequence-exact across the query space; full suite
  green through the gate.
- [x] tbd-5hh1 fixed in `tree-view.ts` with depth-3 goldens (`e5c9360d`).
- [x] Removed the superseded remote-web cancellation path; `bead-watch.ts`, `git.ts`,
  and the standalone `watch` command are unchanged from the base branch.
- [x] tbd-q5c7: `OutputManager.isJson` + `printDocSyncStatus` guard with regression
  test; live-verified pure JSON with a stale docs cache (`e5c9360d`).
- [x] Removed the superseded `sync-run.ts` extraction; standard `sync.ts` is unchanged
  from the base branch, so the local-only viewer cannot alter the CLI sync contract.

### Phase 3: Server productization

- [x] `src/cli/commands/web.ts` handler with the flag surface, descriptor, `--dry-run`,
  and lazy import.
- [x] `src/cli/web/{server,board,local-observer,http}.ts` per the module map: native
  local events plus one-second reconciliation, local snapshot deltas, bounded SSE, port
  policy, readiness-gated `--open`, SSE-aware shutdown, and command-scoped signal
  handlers, all timers `unref()`'d.
- [x] v1 read-only: no mutation route exists.
  `tests/cli-web.test.ts` covers the built artifact, lifecycle, security, Git isolation,
  explicit two-clone `tbd sync`/SSE update, invalid input, and port contention.

### Phase 4: Client productization

- [x] `src/web/{core,client}.ts`, `index.html`, `styles.css`; `tsconfig.web.json`;
  main-project exclusion; both projects in `typecheck`; eslint strictTypeChecked over
  100% of client code with no carve-outs.
- [x] tsdown browser IIFE entry and `scripts/stitch-web.mjs` → `dist/web/index.html`.
- [x] `tests/web-core.test.ts` covers connect-first startup, current-state recovery,
  coalescing, stale board/body success and failure suppression, and an eight-request
  detail ceiling; the CSS test targets the production stylesheet.
  The server artifact test proves the page is fully stitched.

### Phase 5: Documentation and design alignment

- [x] tbd-design.md: §1.6 amended (the scoped exception, owner-directed in this diff)
  and a new CLI-layer section documenting `tbd web` beside §4.14.
- [x] Manual (`tbd-docs.md`) command section; README mention; CHANGELOG entry moved from
  Internal to Features; `docs/development.md` spike section replaced by command usage.
- [x] Spike retired: `scripts/bead-web.ts`/`.html` deleted; real two-clone topology
  construction lives in `tests/cli-web.test.ts` and packed-artifact validation in
  `scripts/validate-web-package.mjs`.

### Phase 6: Production validation and merge

- [x] Local release matrix green after final review: format, strict lint/typecheck,
  build, 1,595 Vitest tests, 1,075 tryscript checks, publint, 31 package-age pins, watch
  release smoke, and packed-web proof.
  The unchanged production audit advisory is tracked separately as `tbd-6gy0`.
- [x] Full matrix green: suite + the `tbd web` tryscript on Ubuntu/macOS/Windows CI; the
  coverage job runs the repository-wide tryscript set on Ubuntu.
- [x] Perf budget assertion on the 10,001-issue boundary fixture, including the
  10,000-row response cap, 5 MiB payload ceiling, exclusion of descriptions and notes,
  and the pure 5,000-row pagination contract.
  Production Chromium measurements above cover the dominant DOM/layout path.
- [x] Isolation assertion reusing the release-smoke snapshot pattern: a running
  `tbd web` leaves the caller worktree, sync refs, `FETCH_HEAD`, hidden worktree, and
  lock untouched. A remote-only change remains invisible until explicit `tbd sync`.
- [x] Packaged proof via `pnpm --filter get-tbd qa:web-package`: the tarball carries
  `dist/web/index.html`, its published launcher starts exactly once, and the extracted
  package serves its page and APIs before clean SIGTERM shutdown.
- [x] Manual/CI pass on macOS plus one other platform.
  The macOS pass on this repository covers operator-readable output, search and ancestor
  context, lazy detail expansion, light/dark/system themes, responsive layout, CSP, and
  a clean browser console; the second platform is supplied by the final CI matrix.
- [x] Current `origin/main` merged cleanly after the local release gate.
- [x] PR description updated to the shipped reality.

### Phase 7: Local-only liveness alignment

- [x] Owner contract recorded under `tbd-ihyx`: no remote polling or implicit sync;
  ordinary `tbd sync` remains the sole remote exchange path.
- [x] `wake.ts` and its remote loop replaced by `local-observer.ts`; the CLI interval
  flag and all remote observer dependencies removed.
- [x] Native events, one-second missed-event reconciliation, degraded modes, local field
  deltas, and explicit-sync acceptance covered by focused tests.
- [x] Final hardening bounds local detail independently of complete motion, publishes
  metadata-only refreshes, orders them with an observer-local state version, resumes
  correctly across ref rewinds and observer restarts, and uses an explicit queued-byte
  ceiling instead of treating Node’s stream high-water mark as a failed client.
  Closed stream races are isolated to the affected SSE client.
- [x] Revised-head local release matrix and senior review green: Flowmark/Prettier,
  strict typecheck, zero-warning lint plus TS/JS lint-contract probes, build, 109 Vitest
  files / 1,508 tests, 1,074 tryscript checks, publint, 31 package-age pins, packed-web
  proof (62,196-byte page), and watch release smoke.
- [x] Push the revised head, wait for hosted CI across the supported OS matrix, re-audit
  every PR comment/thread, and confirm final mergeability.
  Implementation head `152caa48` passed run `31547701354` on Ubuntu, macOS, Windows,
  coverage/lint, benchmark, and secret scanning.
  The PR was open, non-draft, `MERGEABLE`/`CLEAN`; the thread audit found 12 threads and
  the final R24 disposition leaves all 12 resolved.

### Phase 8: Concurrency proof and final revalidation

- [x] Normative ownership, linearization, deadlock, convergence, and guarantee-boundary
  analysis added to tbd-design.md §4.15 before the concurrency implementation was
  finalized (`tbd-hv05`).
- [x] Every confirmed finding recorded under concurrency epic `tbd-p1i5`, with the
  file/function map in R25–R54 below.
- [x] Central persistent writer epoch, lock-free stable-snapshot acceptance, strict
  candidates, ownership-safe locks, single-flight observation, bounded retry/replay and
  client fan-out, cancellation, and shutdown fences implemented with adversarial focused
  coverage.
- [x] Full release matrix green on the final concurrency head: Flowmark/Prettier, strict
  typecheck and zero-warning lint, build, 113 Vitest files / 1,568 tests, 1,075
  tryscript checks, publint, 31 package-age pins, packed-web proof (64,485-byte page),
  watch release smoke, 5,000-issue CLI benchmark, and the 10,001-issue web boundary
  above.
- [x] Final head pushed; hosted CI, all PR threads, and mergeability rechecked.

### Phase 9: Installed Agent Discovery and Viewer Ownership

- [x] The full, brief, and minimal shipped tbd skills route natural requests such as
  “Show my beads in a browser” to an agent-run `tbd web --open` process.
- [x] Setup onboarding and `welcome-user` teach the same natural-language request
  without transferring CLI operation to the user.
- [x] README, CLI manual, design, changelog, startup output, and the rendered page state
  one ownership contract: the browser is a live viewer, never an editor; the agent makes
  changes through ordinary tbd commands; local results appear automatically; remote
  exchange remains explicit `tbd sync`.
- [x] Built-distribution and setup-flow regressions prove the guidance reaches the npm
  artifact and generated `.agents`/`.claude` skill mirrors.

### Final review finding map

The original final review is tracked under `tbd-o7nu`, with the owner-directed revision
and its follow-up findings under `tbd-ihyx`. R1–R23 were implemented and validated; R24
was rejected with code-path evidence because the reported persistence was never part of
the client contract.
The final concurrency review is tracked under epic `tbd-p1i5`: R25–R35 and R38–R57 are
concrete defects, while R36–R37 are its normative design and adversarial verification
tasks. Every item has one bead and an explicit file/function disposition.

R14 removes the final Windows command-shim assumption from the packed proof.
R15 closes the final scale-specific memory and data-motion paths after the 10,000-row
ceiling review. R16 preserves an executable assertion on both sides of that ceiling.
R17 bounds pretty-tree metadata by the same response slice.
R18 marks a capped table command-inexact and names truncation in its tooltip.
R19 is the owner-directed contract revision tracked by `tbd-ihyx`: remote liveness is
removed from the viewer, local observation becomes native plus reconciled, and all
surfaces point users back to explicit `tbd sync`. R20 isolates the final SSE
closed-stream race found during the revised-head senior review.
R21 prevents a delayed duplicate bounded event from replacing canonical same-version
board state. R22 makes the constant-size local observation assertion platform-native
after the first revised-head hosted run exposed POSIX-only expected strings on Windows.
R23 reconciles expanded client rows by stable internal identity after display-ID remaps.
R24 confirms that filter, display-mode, and page changes already cleared expansions
before R23, and that live rows outside the bounded response must not retain unverifiable
display ids or consume the detail cap.

| Bead | Severity | File/function seam | Disposition |
| --- | --- | --- | --- |
| `tbd-x8g8` (R1) | P2 | `src/web/core.ts`: `Store.fetchBody`, `bodyRequestIsCurrent` | Gate stale success and error responses on request token plus data generation; regression covers the unresolved PR thread. |
| `tbd-b3a3` (R2) | P2 | `src/web/core.ts`: `loadBody`, `drainBodyQueue`, `pruneBodyQueue` | Limit detail fetches to eight and discard collapsed queued work. |
| `tbd-3w9e` (R3) | P1 | `scripts/copy-docs.mjs`: postbuild `dist/tbd` launcher | Import canonical `bin.mjs` instead of copying it as a second ESM identity; tryscript proves one action/descriptor. |
| `tbd-oi4e` (R4) | P1 | Removed remote observer | Historical fix was validated; R19 removes the web remote loop entirely, so no cursor retry remains in the viewer. |
| `tbd-t7to` (R5) | P1 | Removed remote sync helper | R19 removes the only web caller, so the final head also removes `sync-run.ts` and restores standard `sync.ts` unchanged. |
| `tbd-urft` (R6) | P2 | `src/cli/commands/web.ts`: `WebHandler.run` | Run idempotent full teardown after either a signal or listener-first close. |
| `tbd-t6gm` (R7) | P1 | `src/cli/web/board.ts`: `PUBLIC_ID`, `BoardState.getBead` | Accept canonical dot/underscore/hyphen display IDs while rejecting option-shaped input. |
| `tbd-rmvx` (R8) | P2 | `tests/rescue-divergence.test.ts`: true-conflict rescue integration | Give the Git/subprocess integration case an explicit timeout after it passed alone in 0.7 seconds but reached 8.4 seconds under the full parallel suite. |
| `tbd-ijz7` (R9) | P2 | `tests/cli-setup.tryscript.md`: top-level help golden | Pin `web` in the complete command listing as well as its dedicated help transcript. |
| `tbd-b4m2` (R10) | P1 | five `tests/cli-sync-*.tryscript.md` fixtures: `before` remotes | Keep each bare remote inside its sandbox’s own Git directory so sync histories cannot leak between transcript files. |
| `tbd-snb4` (R11) | P1 | `tests/cli-web.tryscript.md`: built CLI invocation | Invoke `bin.mjs` explicitly with Node so the focused matrix transcript does not depend on Unix extensionless-command lookup. |
| `tbd-qf41` (R12) | P1 | Removed remote observer | Historical regression was validated; R19 makes a missing remote irrelevant to `tbd web` because it performs no remote operation. |
| `tbd-4ets` (R13) | P1 | `tests/run-built-cli.mjs`; `tests/cli-web.tryscript.md`: sandbox invocation, setup, and filters | Spawn and await the exact built entry using a Node-resolved path, assert sandbox initialization as a test, and use shell-neutral quoting for `sed`/`jq`. |
| `tbd-wx19` (R14) | P1 | `scripts/validate-web-package.mjs`: `packArchive` | Keep direct `execFile` on POSIX; on Windows run the `pnpm.cmd` shim through `ComSpec` before continuing the exact packed-artifact proof. |
| `tbd-z3o9` (R15) | P2 | `src/web/core.ts`: `Store.toggle`, `setExpanded`, `cacheBody`, `receiveState`; `src/web/client.ts`: `renderBoard` | Limit open details to 100, cached bodies to 200, deletion ghosts to 100, and replace scale-sensitive row-class array scans with set lookup. |
| `tbd-et3a` (R16) | P2 | `tests/performance.test.ts`: 10,001-issue boundary fixture | Prove that 10,000 rows are returned without exceeding the response ceiling and that `truncated` retains the full over-limit count. |
| `tbd-6pjo` (R17) | P2 | Superseded pretty-tree ancestor context | Historical capped-context fix was validated; the final exact-filter design removes injected ancestor rows entirely, so Active and every other filter match `tbd list --pretty`. |
| `tbd-wmdo` (R18) | P2 | `src/cli/web/board.ts`: `BoardState.buildBoardResponse`; `src/web/core.ts`: `caveatsFor` | Mark every capped response command-inexact and explain in the tooltip that only the returned prefix is shown. |
| `tbd-ihyx` (R19) | P1 | `src/cli/web/{board,local-observer}.ts`; `commands/web.ts`; `web/{core,client}.ts`; all web docs/tests | Make the viewer local-only, remove the poll flag, observe native changes immediately, reconcile missed events once per second, bound local detail without losing motion, recover across observer restarts, and prove explicit `tbd sync` is the only remote path. |
| `tbd-xp1v` (R20) | P2 | `src/cli/web/http.ts`: `SseHub.attach`, `SseHub.write`; `tests/web-http.test.ts` | Check ended streams, catch a write-time close race, and install a per-response error handler so one disconnected client cannot escape a publish or heartbeat into the server process. |
| `tbd-t5ky` (R21) | P1 | `src/web/core.ts`: `Store.receiveState`; `tests/web-core.test.ts` | Reject duplicate SSE frames at an already-adopted observer state version, while preserving the deliberate same-version canonical board recovery, so bounded transport cannot overwrite complete changed-row motion. |
| `tbd-wykg` (R22) | P1 | `tests/web-board.test.ts`: constant-size observation-surface assertion | Build expected paths with Node’s platform-native `path.join`, matching production behavior on Windows, macOS, and Linux. |
| `tbd-qdhn` (R23) | P1 | `src/web/core.ts`: `Store.runRefreshLoop`, `Store.receiveState`, `Store.reconcileExpandedRows`; `tests/web-core.test.ts` | Wait for the canonical board after graph motion, remap expanded rows by stable internal id, drop vanished stale entries, and only then refetch bodies under current display ids. |
| `tbd-is2r` (R24) | P2 | `src/web/client.ts`: `applyControls`, pretty-mode handler, `navigateBoardPage`; `src/web/core.ts`: `Store.reconcileExpandedRows` | No code change: query/display/page transitions cleared expansions before R23. On live motion, retaining a row absent from the bounded canonical response would preserve an unverifiable display id, recreate stale body requests, and invisibly consume `MAX_EXPANDED_ROWS`; user and design docs now state that boundary. |
| `tbd-6ka1` (R25) | P1 | `src/cli/web/local-observer.ts`: `enqueueRefresh`, `drainRefreshes`, `coalesceRefresh` | Replace the unbounded promise tail with one active reload and one coalesced pending slot; burst regression proves bounded work and final-state convergence. |
| `tbd-j6tx` (R26) | P1 | `src/file/data-sync-epoch.ts`; `src/file/common-dir-layout.ts`: `withSharedDataSyncLock`; `src/cli/web/board.ts`: `reloadOnce`, `captureQuiescentEpoch` | Add a persistent active/quiescent writer epoch and require the identical quiescent token around a privately staged candidate. A writer that starts and finishes inside a read is rejected even when metadata is unchanged. |
| `tbd-3eti` (R27) | P2 | `src/cli/web/http.ts`: `SseHub.attach`, `write`, `drop`, `close` | Install close/error handling before headers or frames, register before replay, and make drop/close idempotent so synchronous disconnects affect one client only. |
| `tbd-wuhe` (R28) | P2 | `src/web/core.ts`: `Transport.fetchJson`, `Store.runRefreshLoop`, `fetchBody`, `abortBodyRequests`; `src/web/client.ts`: fetch adapter | Thread `AbortSignal` through board and detail requests; abort superseded work and retain generation/token checks for transports that complete late. |
| `tbd-blvk` (R29) | P1 | `src/cli/lib/data-context.ts`: `loadDataContext`; `src/cli/web/server.ts`: `prepareWebContext`; `src/cli/web/board.ts`: default loader | Perform repair and epoch establishment once before viewer resources exist; make every live reload strictly non-repairing and non-locking. |
| `tbd-sofi` (R30) | P1 | `src/cli/web/local-observer.ts`: `start`, `stop`, `readMarker`, `refresh`, `handleNativeFailure` | Mark stopped before teardown and recheck it after every awaited boundary so late callbacks cannot mutate or publish state. |
| `tbd-w6x0` (R31) | P1 | `src/cli/commands/web.ts`: `WebHandler.run` | Complete potentially long writer-lock preparation before replacing default signal behavior; interrupted startup cannot enter the viewer shutdown wait graph. |
| `tbd-dfdv` (R32) | P1 | `src/cli/web/local-observer.ts`: `refresh`, `scheduleRefreshRetry` | Invalidate the accepted marker after a transient reload error and retain one cadence-limited retry, so recovery does not require another event and cannot busy-loop. |
| `tbd-cvq6` (R33) | P1 | `src/cli/web/http.ts`: `framesAfter`, `replaySuffix`, `attach` | Select a chronological replay suffix within the client byte budget and always end normal production replay with current state. |
| `tbd-ztyg` (R34) | P1 | `src/file/storage.ts`: `listIssues`; `src/cli/web/board.ts`: `readCompleteIssueSnapshot` | Report directory/read/parse failures and validate filename-to-ID identity; reject the whole candidate rather than publishing transient deletions or duplicate logical rows. |
| `tbd-p4og` (R35) | P1 | `src/cli/commands/doctor.ts`: mapping, temp, migration, worktree/layout repair paths | Route every `doctor --fix` shared-data mutation through the central fenced wrapper and re-read stale diagnostic inputs after acquiring it. |
| `tbd-hv05` (R36) | P1 | `packages/tbd/docs/tbd-design.md`: §4.15 “Concurrency and Snapshot Safety” | State the safety property, owners, persistent-fence proof, linearization point, bounded progress/deadlock argument, guarantee boundary, and adversarial proof obligations. |
| `tbd-ag6j` (R37) | P1 | `tests/{data-sync-epoch,lockfile,snapshot-consistency,web-board,web-local-observer,web-http,web-core,cli-web,common-dir-layout-doctor}.test.ts` | Force writer/read, lease loss, event/reconcile, attach/close, stale response, transient failure, and shutdown interleavings; assert old-or-new snapshots, bounded work, monotonic adoption, and cleanup. |
| `tbd-an5y` (R38) | P0 | `src/utils/lockfile.ts`: `withLockfile`, heartbeat, ownership-checked removal; `tests/lockfile{,-acquisition-race}.test.ts` | Give each lock a unique owner marker, heartbeat responsive holders, assert lease ownership before the writer epoch commits, and prevent a displaced holder or provisional acquisition cleanup from removing its successor. Regressions force a multi-stale-window hold, a renamed-holder/successor overlap, and displacement between `mkdir` and exclusive owner installation. |
| `tbd-i6it` (R39) | P1 | `src/file/id-mapping.ts`: `loadIdMapping`, `saveIdMapping`, `replaceRecoveredIdMapping`; mapping and recovery callers; `tests/concurrent-mapping.test.ts` | Treat only `ENOENT` as an absent optional mapping, propagate all other read/parse failures, and keep explicit conflict recovery separate so an unreadable append-only mapping cannot become an empty map or be overwritten. |
| `tbd-a8pj` (R40) | P2 | `src/file/data-sync-epoch.ts`: `readDataSyncEpoch`; `src/cli/web/snapshot-consistency.ts`; marker tests | Read at most 128 epoch bytes, strictly parse the token in both snapshot and reconciliation paths, and reject oversized machine-local state without repeated unbounded allocation. |
| `tbd-7all` (R41) | P2 | `src/cli/web/http.ts`: `SseHub.attach`; `tests/web-http.test.ts` | Cap the aggregate SSE client set at 64 and reject excess attaches before streaming, bounding total socket buffering and synchronous fan-out work in addition to each client’s byte queue. |
| `tbd-0w8j` (R42) | P1 | `src/cli/commands/doctor.ts`: `run`, `checkDataLocation`; `tests/common-dir-layout-doctor.test.ts` | Run misplaced-data preflight before diagnostics and keep worktree initialization/repair plus migration inside one writer epoch, so one `doctor --fix` cannot expose an empty intermediate graph. |
| `tbd-xppg` (R43) | P1 | mutating CLI pipelines in `tests/*.tryscript.md` | Replace early-closing `head` consumers with EOF-reading `sed -n` selectors. A transcript must not terminate a writer after it publishes output but before its transaction releases the crash-recovery lock and quiesces its epoch. |
| `tbd-4sle` (R44) | P0 | `src/utils/lockfile.ts`: acquisition, release, and stale recovery; `tests/lockfile*.test.ts` | Record token/host/pid ownership before entering the critical section, keep fresh ownerless and every ambiguous/live identity non-recoverable, move verified releases out of the canonical path before cleanup, and quarantine each dead generation at a retained token-derived path so delayed stale observers cannot displace a successor through canonical-path ABA. |
| `tbd-wvns` (R45) | P1 | `src/utils/lockfile.ts`: `startLockHeartbeat`, final ownership/release fence; `tests/lockfile-acquisition-race.test.ts` | Keep heartbeat timestamp maintenance advisory: failure disables further touches but direct token checks remain authoritative, so a valid owner still quiesces its writer epoch and releases instead of stranding active state. |
| `tbd-8kpc` (R46) | P2 | `src/utils/lockfile.ts`: `prepareLockOwnerGeneration`, `runWithPreparedLockGeneration`; `tests/lockfile-acquisition-race.test.ts` | Write and close a complete non-empty owner generation before canonical `mkdir`, install it atomically before entering the critical section, and remove only an empty failed provisional directory. Forced open/write failure leaves no canonical lock, while a delayed installer cannot overwrite a successor. |
| `tbd-n7oc` (R47) | P1 | `src/utils/lockfile.ts`: mkdir acquisition and owner-generation install; `tests/lockfile{,-acquisition-race}.test.ts` | Preserve the established mkdir election and use the already-required same-filesystem directory rename for metadata installation, with no hard-link dependency. Regressions make hard links fail, prove normal acquisition still succeeds, and recover a stale empty legacy/provisional mkdir generation without weakening fresh-lock exclusion. |
| `tbd-ejt1` (R48) | P2 | `src/utils/lockfile.ts`: `removeEmptyLockDir`, stale ownerless acquisition branch; `tests/lockfile-acquisition-race.test.ts` | Return whether empty-only cleanup made progress. Retry immediately only after removal; a stale non-empty unrecognized generation remains fail-closed on the ordinary poll cadence instead of spinning until timeout. |
| `tbd-qhiq` (R49) | P2 | `src/utils/lockfile.ts`: failed owner-generation install classification; `tests/lockfile-acquisition-race.test.ts` | After failed install, distinguish a raced canonical parent from a vanished token-private source. Retry only while the prepared generation still exists; otherwise clean an empty reservation and surface the original error instead of looping until timeout. |
| `tbd-pt35` (R50) | P2 | `src/utils/lockfile.ts`: `breakStaleLock`, stale acquisition branch; `tests/lockfile-acquisition-race.test.ts` | Return whether deterministic quarantine rename made progress. Retry immediately only after the canonical dead generation moved; an occupied retained quarantine remains fail-closed on the ordinary poll cadence instead of spinning. |
| `tbd-81j0` (R51) | P1 | `src/file/common-dir-layout.ts`: `withSharedDataSyncLock`; `src/cli/commands/doctor.ts`: `checkSharedLockWritability`; `tests/shared-lock-permission.test.ts` | Classify EPERM/EACCES from canonical, token-private, and nested owner paths as shared-lock failures while preserving unrelated critical-section errors. Exercise the complete lock lifecycle in doctor and force each new permission boundary in focused regressions. |
| `tbd-c4nj` (R52) | P1 | `docs/shortcuts/system/skill-{baseline,brief,minimal}.md`; `docs/shortcuts/standard/welcome-user.md`; `src/cli/commands/{setup,web}.ts`; `src/web/index.html`; README, manual, design, changelog; distribution/setup/web artifact tests | Route natural browser-view requests to an agent-run `tbd web --open`, keep mutation ownership in ordinary tbd commands, state that the live browser is not an editor, and prove generated/install/package surfaces carry the contract. |
| `tbd-rhdp` (R53) | P2 | `docs/shortcuts/system/skill-minimal.md`; `tests/integration-files.test.ts` | Align the minimal shipped skill with the package’s Node.js 20+ engine and prevent future distribution drift. |
| `tbd-prtc` (R54) | P1 | `src/utils/lockfile.ts`: `runWithPreparedLockGeneration`, provisional identity helpers; `tests/lockfile{,-acquisition-race}.test.ts`; design concurrency proof | Classify a raced owner-install failure by canonical generation identity, so macOS `EINVAL` after removal retries without overwriting an installed replacement while the same-generation error remains raw. Deterministic tests prove recovery, fail-closed classification, single execution, and cleanup; whole-suite concurrency revalidates the original waiter race. |
| `tbd-7156` (R55) | P2 | `src/web/client.ts`: `renderBoard`; `tests/bead-web-css.test.ts` | Keep the concise `Expand all` / `Collapse all` labels, but state in the tooltip that the working set is the current page, matching `paginateBoardRows` and the documented bounded-detail contract. |
| `tbd-z0j7` (R56) | P2 | `src/web/styles.css`: live-change marker; `tests/bead-web-css.test.ts` | Attach the persistent change marker to `.copy-value::after`, immediately after the literal bead ID and before the copy control’s reserved space. |
| `tbd-z1za` (R57) | P1 | `tests/issue-changes.test.ts`: `createChangesReportFromRefs` describe; `tests/test-helpers.ts`: `subprocessTestTimeout` | Apply the standard 30-second integration budget with a 60-second Windows floor to the synthetic Git-history block. Parallel Windows load can no longer trip Vitest’s 5-second unit default and begin teardown while Git still owns the temp repository. |

### Merge gate for PR #207

All of the following must be verified in the PR before merge; the PR remains unmerged
until they hold:

1. Every phase checklist above complete.
2. CI green on the final head across all three platforms; publint and package-age clean;
   no new runtime dependency.
3. The packaged-tarball proof (Phase 6) recorded in the PR.
4. Spike scripts gone; no dead flag or dormant mutation code shipped.
5. Docs complete: installed skill tiers, setup and welcome onboarding, design doc
   (including the §1.6 amendment), manual, README, help/startup text, browser ownership
   copy, and CHANGELOG.
6. Owner sign-off on the §1.6 amendment diff and the final review pass.

## Testing Strategy

- **Query parity is the load-bearing test.** Property-style comparison asserting that
  for a corpus of queries, `selectIssues` returns exactly what the current `list` and
  `ready` filters return.
  This is what makes the refactor safe.
- **Aggregate parity**: `tbd stats --json` and the served stats object must be
  byte-equal for the same repository.
  `web-board.test.ts` exercises the same `computeIssueStats` result through board state.
- **Hierarchy**: depth-3 golden test for `--pretty`, and a test that the server’s row
  order matches `buildIssueTree` for the same input.
- **Liveness**: unit-test startup gap closure, trailing native debounce, unchanged
  reconciliation ticks, marker-detected changes, native-only and reconciliation-only
  degraded modes, recovery, and bounded shutdown.
  The two-clone acceptance test first proves a remote commit leaves local refs,
  `FETCH_HEAD`, files, and UI untouched; it then runs ordinary `tbd sync` and requires
  the local result over SSE.
- **Payload bounds**: assert table responses carry no description or notes text, local
  motion remains complete in the canonical board state while field detail is capped at
  100 candidates and 256 KiB, and event-frame size does not grow with graph size.
- **Performance**: exercise a 10,001-issue boundary fixture; assert the 10,000-row cap,
  board response time and serialized size against the §1.4 budget, assert 5,000-row page
  boundaries in the pure client core, and measure the stitched page in Chromium because
  server timing does not represent DOM construction, style, layout, or paint.
- **Isolation**: reuse the release-smoke assertions.
  Running `tbd web` must leave the caller worktree, sync refs, `FETCH_HEAD`, hidden
  worktree, and lock untouched.
  There is no viewer-owned exception.
- **Security**: assert the listener binds loopback only, every non-GET request is 404,
  hostile Host and Origin headers are 403, and bead ids are validated before lookup.
- **CLI conventions**: assert stdout carries only the descriptor and diagnostics go to
  stderr, that `--dry-run` binds nothing, that a bad `--port` exits 2, and that Ctrl+C
  exits 130.
- **Port policy**: with the default port taken, the server binds the next candidate and
  the descriptor carries the port actually bound; with an explicit `--port` taken, exit
  1 with an actionable message; range exhaustion names the orphaned-server hypothesis.
- **Lifecycle**: the `--open` readiness probe opens nothing until the index route
  returns HTTP OK and degrades to printing the URL; first SIGINT closes open SSE streams
  and exits cleanly with no error-level log records from the expected cancellations.
- **Client behavior, jsdom-free**: `src/web/core.ts` contracts covered with injected
  `fetch`/`EventSource` stubs — connect-then-fetch ordering, current-state recovery,
  observer-restart recovery, state-version ordering, canonical same-version board
  recovery, update coalescing, delta gating on `changeDataVersion`, and query-string
  round-tripping — following metabrowser’s stubbed-window test pattern.
- **Startup cost**: assert that adding the command does not measurably change
  `tbd --help` or `tbd list` startup time, which is what the lazy import exists to
  protect.

## Rollout Plan

Additive and opt-in, with no schema, config, format, or dependency change.
Repositories that never invoke `tbd web` see no new behavior.

The command and core refactors ship together after the final gate.
Documentation calls it a local view, not a service.
Rollback is removing the command and its additive modules; no data migration exists to
undo.

## Implementation Decisions

Resolved by the owner’s 2026-08-10 productionization direction and 2026-08-11 local-only
liveness decision:

- `tbd web` ships in core through PR #207, which merges only production-ready; no
  separate package.

- The §1.6 amendment is in scope for this PR and reviewed in its diff.

- The web observer is local-only and in-process.
  Node core supplies native filesystem events; a one-second constant-size marker repairs
  dropped events without a dependency or unchanged-graph reload.

- Complete changed-row motion in the canonical board state is independent of bounded
  event/detail transport; an observer instance id plus monotonic state version makes a
  live browser resilient to server restarts and stale equal-graph-version responses.

- v1 is read-only; the mutation route is removed, not hidden (see Writes).

- `tbd web` has no remote poll option and never performs implicit sync.
  `tbd sync` is the sole remote exchange contract, and its local result appears
  automatically.

- In agent sessions, natural browser requests route to agent-run `tbd web --open`. The
  browser changes presentation only; the agent remains the sole tbd operator for
  mutations and remote exchange.

- The query, statistics, tree, and JSON-output fixes ride PR #207; remote-watch and sync
  internals stay unchanged because the viewer no longer consumes them.

- Dense-board presentation uses cross-filtered categorical facets, four-line collapsed
  titles, relative update ages, fast delegated tooltips, and bounded two-key header
  sorts defaulting to Updated descending then Priority ascending.
  Sorting never changes Pretty.
  Pretty reorders only outermost visible groups using each complete visible subtree’s
  maximum Updated timestamp while preserving official child order; Flat applies the same
  bounded stack to individual rows.

- Live rendering delegates row expansion to one table-body listener, ignores clicks that
  finish a non-collapsed text selection, restores keyboard focus by stable identity, and
  dismisses tooltips whose anchors were replaced.
  Label-search drafts survive intervening live renders until their debounce lands, and
  Home/End preserve native caret movement while that field owns focus.
  A board-refresh failure retains the last successful rows and remains visible in the
  observer indicator until recovery.

## References

- `plan-2026-07-19-bead-watch-and-external-sync.md` — the separate remote `watch`
  contract that the web viewer deliberately does not embed
- `valid-2026-08-09-bead-watch-release.md` — isolation and resource assertions to reuse
- `packages/tbd/docs/tbd-design.md` §1.5, §1.6, §1.7, §4.10, §4.12
- `packages/tbd/src/lib/issue-selection.ts` — the existing shared predicates
- `packages/tbd/src/cli/lib/tree-view.ts` — `buildIssueTree` and the `tbd-5hh1` defect
- PR #207’s Phase 1 commits — retired spike evidence and review history
- `github.com/jlevy/metabrowser` — `src/metabrowser/watch_backends.py` for the native
  watcher plus bounded reconciliation architecture; `src/metabrowser/sse.py` for bounded
  frames; `src/metabrowser/static/styles.css` for flash and reduced-motion;
  `src/metabrowser/cli/serve.py` for readiness-gated auto-open, port-range search, and
  SSE-aware shutdown with suppressed cancellation noise; `tests/dom/` for the
  stubbed-window, jsdom-free client behavior tests; `tsconfig.json`/`biome.json` for the
  client QA floor this plan matches and exceeds
- Beads: `tbd-5hh1` (tree depth), `tbd-q5c7` (stdout JSON contract), `tbd-w5xi`
  (`--due`)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
