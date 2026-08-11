---
title: "tbd web: Live Bead View"
description: An optional local web view over committed bead state, driven by the watch layer and sharing the CLI's query semantics
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: `tbd web` — Live Bead View

**Date:** 2026-08-10 (last updated 2026-08-11)

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Implemented on PR #207; final cross-platform CI and merge validation in
progress

## Overview

A single optional command, `tbd web`, serves a loopback-only page that renders the bead
graph and updates itself as committed state moves.
It is a read-first view built on the watch infrastructure from
`plan-2026-07-19-bead-watch-and-external-sync.md`: the same additive-only JSON report
that wakes an agent also wakes a browser tab (see tbd-design.md §4.14).

The governing constraint is that the browser must not become a second, drifting
implementation of `tbd list`. Every filter the UI offers is a CLI flag, evaluated by the
CLI’s own predicates, and each response carries the equivalent command line.

The delivery vehicle is PR #207, and its bar is explicit: **it merges once, when
`tbd web` is production-ready, and not before.** A disposable server and page proved the
interaction in Phase 1. The production command now replaces that spike with typed,
tested, packaged modules and the spike files have been retired.
This document is the implementation record at file and function level; the remaining
unchecked items are external CI and merge-state evidence, not implementation scope.

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
  browser (strictly-linted TS, built by tsdown; see Client build and packaging)
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

**Remote.** `WakeCoordinator` calls `watchForIssueChanges` in-process with
`selection: { kind: 'all' }`, a resume tip, and an `AbortSignal`. On a report the server
calls `runIssueSync(..., { pull: true, signal, networkTimeoutMs })`, reloads the board,
and publishes state.
The report’s `tip` becomes the next `--since` only after that application succeeds, so
transient pull failures retry the same window instead of dropping it.
The tip is also the SSE event id so a browser reconnect resumes the same way.
Timeout is a normal recycle; operational failures back off, and only a proven
non-ancestor rewrite resets the cursor to the remote tip.

**Local.** `fs.watch` over the hidden sync worktree’s issues directory, debounced, for
edits made in this checkout before anyone publishes them.
This is the only part with no CLI analogue, because `tbd watch` observes the remote
only.

A pull and the viewer’s own writes touch the same files a local edit does, and their
filesystem events can outlive the operation that caused them.
Attribution is therefore by observed `id:version` difference, not by timing.
Reloads are serialized so a slow pre-pull read cannot replace a post-pull snapshot, and
the watch is cancelled in-process during bounded shutdown.

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
tbd web [--port <n>] [--open] [--interval <seconds>]
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
- **Exit codes come from the shared `exit-codes.ts`** that PR #205 centralized.
  Clean shutdown is 0, usage error 2, operational failure 1, and Ctrl+C is 130. Since
  Ctrl+C is the normal way to stop a server, 130 on the ordinary path is worth stating
  explicitly rather than discovering.
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
  resume, wake-coalescing, and query-string contracts with stubs, and the un-injected
  DOM glue stays too thin to need a browser.

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
- **One in-memory snapshot.** Loaded once at startup and replaced on a wake.
  Queries run against it, so no request touches the filesystem.
- **SSE backpressure.** `response.write()` returning false, or a rising
  `writableLength`, means a slow client.
  Drop that client rather than buffering without bound; the browser reconnects and
  resumes from `Last-Event-ID`.
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

- **`src/file/bead-watch.ts`**: `IssueWatchOptions` gains `signal?: AbortSignal`;
  `IssueWatchResult` gains `{ kind: 'aborted' }`. The poll loop checks the signal at
  each await point, `sleep` becomes abort-aware, and cleanup still runs in `finally`.
  `git.ts` gains an options-object overload
  `gitNoPromptWithTimeout({ timeoutMs, signal }, ...args)` that SIGTERMs the child on
  abort; the existing positional form stays for current callers.
  The CLI `watch` command passes no signal, so its behavior is unchanged.

- **`src/file/sync-run.ts`**: the issues-pull path is
  `runIssueSync({ worktreePath, syncBranch, remote }, { pull: true, signal?, networkTimeoutMs? }, logger)`,
  which returns a structured `up-to-date`, `pulled`, or `remote-missing` result.
  Supplying a signal or deadline selects the no-prompt bounded fetch used by embedded
  callers; omitting both preserves interactive `sync --pull` behavior.
  `sync.ts` translates the result into its existing presentation while the web wake path
  uses it without spawning a CLI subprocess.

- **`src/cli/lib/tree-view.ts`**: `renderTreeNode` emits
  `prefix + connector + issueLine` (tbd-5hh1); depth-3 golden test added.

- **`src/cli/lib/output.ts`**: `OutputManager` gains a public `get isJson(): boolean`;
  `docs-sync-output.ts#printDocSyncStatus` returns early under it (tbd-q5c7).

### Server (Phase 3)

- **`src/cli/commands/web.ts`**: Commander definition plus
  `WebHandler extends BaseCommand`. Flags: `--port <n>`, `--open`,
  `--interval <seconds>` (min 10, default 30), `--dry-run`; global `--json` emits the
  startup descriptor `{ url, port, pid, repo, syncBranch }` on stdout.
  The handler validates flags, resolves the repo (`requireInit`, `readConfig`), then
  lazy-imports the server (`await import('../web/server.js')`) so no other command pays
  for it. SIGINT/SIGTERM wiring per the lifecycle rules; exit codes from `exit-codes.ts`.
- **`src/cli/web/server.ts`**:
  `startWebServer(options: WebServerOptions): Promise<WebServerHandle>` where the handle
  is `{ port, url, close(), closed: Promise<void> }`. Owns the `node:http` server, port
  policy (`findAvailableLoopbackPort(base, count)` here, mirroring metabrowser’s
  `server_utils.py`), readiness self-probe, and shutdown.
- **`src/cli/web/board.ts`**: `BoardState` — the in-memory snapshot (`loadDataContext` +
  `listIssues`), `reload()` computing `dataVersion`/`movedIds`/`removedIds`/`changedIds`
  by `id:version` diff, `computeIssueStats`, the served `RepoStatus`, and
  `buildBoardResponse(params)` translating query strings to `IssueQuery` and calling
  `selectIssues`/`describeQuery` plus the tree/context-row walk over `buildIssueTree`.
- **`src/cli/web/wake.ts`**: the two wake paths — `watchForIssueChanges` in-process with
  the new `AbortSignal` (the spike’s child process retires), and the debounced
  `fs.watch` on the hidden worktree with the post-write suppression window.
  On a remote wake: bounded/cancellable `runIssueSync`, then `board.reload()` and
  broadcast; the report cursor advances only after all three succeed.
- **`src/cli/web/http.ts`**: router with Host/Origin validation, `GET /`,
  `GET /api/board`, `GET /api/bead`, `GET /api/events` (SSE hub: event id = report tip,
  `Last-Event-ID` resume, heartbeats, backpressure drop), `sendJson`, request body
  limits. No mutation route exists in v1.

### Client (Phase 4)

- **`src/web/core.ts`** (pure; no DOM, no globals): transport-injected store.

  ```ts
  export interface Transport {
    fetchJson(url: string): Promise<unknown>;
    openEvents(url: string, onState: (s: unknown) => void, lastEventId?: string): { close(): void };
  }
  export function createClientStore(transport: Transport, onRender: () => void): ClientStore;
  export function buildQueryString(controls: BoardControls): string;
  export function caveatsFor(board: BoardResponse): string[];
  export function deltasValid(watch: WatchStateView): boolean;  // reportDataVersion gate
  export function phaseLabel(watch: WatchStateView): { label: string; help: string };
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
- `tests/bead-watch.test.ts` — abort during sleep, during fetch, cleanup-on-abort.
- `tests/sync-run.test.ts` — structured pull results plus the cancellable bounded-fetch
  path used by the web wake loop.
- `tests/tree-view.test.ts` — depth-3 golden (tbd-5hh1).
- `tests/web-board.test.ts` — light rows, shared queries, tree context, movement, body
  lookup, and canonical display-id alphabets.
- `tests/web-http.test.ts` — GET-only routing, Host/Origin security, detail isolation,
  SSE replay, and frame bounds.
- `tests/web-wake.test.ts` — pull-before-reload, local debounce, thrown and structured
  pull failure retry without cursor loss, rewritten-history recovery, and shutdown
  cancellation.
- `tests/web-server.test.ts` — port policy, readiness, idempotent teardown, and the
  stitched production artifact.
- `tests/web-core.test.ts` — stubbed `Transport`: connect-then-fetch ordering, SSE
  resume via `Last-Event-ID`, wake coalescing, `deltasValid` gating, query round-trip.
- `tests/cli-web.test.ts` — spawn the built binary as `cli-watch.test.ts` does: bind,
  descriptor shape, port policy (default searches; explicit `--port` conflict exits 1
  actionably), Host/Origin 403s, SIGINT exits 130, no mutation route (POST → 404).
- `tests/bead-web-css.test.ts` — retargeted to `src/web/styles.css`, assertions kept.
- `tests/cli-web.tryscript.md` — `--help` and `--dry-run` transcripts.
- `performance.test.ts` — board response budget on the 5,000-issue fixture.
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
- [x] `AbortSignal` through `bead-watch.ts` and the `git.ts` options overload, with
  pre-aborted/sleep/fetch cancellation coverage; CLI `watch` behavior unchanged.
- [x] tbd-q5c7: `OutputManager.isJson` + `printDocSyncStatus` guard with regression
  test; live-verified pure JSON with a stale docs cache (`e5c9360d`).
- [x] `src/file/sync-run.ts` extraction; `sync.ts` refactored with no behavior change.
  `runIssueSync` owns the fetch/count/attach/fast-forward pull sequence, returns a
  structured result, and has injected-dependency coverage for pulled, up-to-date,
  missing-remote, failure, bounded-fetch, and cancellation cases.

### Phase 3: Server productization

- [x] `src/cli/commands/web.ts` handler with the flag surface, descriptor, `--dry-run`,
  and lazy import.
- [x] `src/cli/web/{server,board,wake,http}.ts` per the module map: in-process wake via
  `AbortSignal` (child process retired), pull via `runIssueSync`, SSE event id = tip
  with `Last-Event-ID` resume, port policy, readiness-gated `--open`, SSE-aware shutdown
  and command-scoped signal handlers, all timers `unref()`'d.
- [x] v1 read-only: no mutation route exists.
  `tests/cli-web.test.ts` covers the built artifact, lifecycle, security, Git isolation,
  real two-clone sync/SSE wake, invalid input, and port contention.

### Phase 4: Client productization

- [x] `src/web/{core,client}.ts`, `index.html`, `styles.css`; `tsconfig.web.json`;
  main-project exclusion; both projects in `typecheck`; eslint strictTypeChecked over
  100% of client code with no carve-outs.
- [x] tsdown browser IIFE entry and `scripts/stitch-web.mjs` → `dist/web/index.html`.
- [x] `tests/web-core.test.ts` covers connect-first startup, persisted cursor resume,
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
  build, 1,497 Vitest tests, 1,073 tryscript checks, publint, 31 package-age pins, watch
  release smoke, and packed-web proof.
  The unchanged production audit advisory is tracked separately as `tbd-6gy0`.
- [ ] Full matrix green: suite + the `tbd web` tryscript on Ubuntu/macOS/Windows CI; the
  coverage job runs the repository-wide tryscript set on Ubuntu.
- [x] Perf budget assertion on the 5,000-issue fixture, including the 4,000-row render
  cap and exclusion of descriptions and notes from board rows.
- [x] Isolation assertion reusing the release-smoke snapshot pattern: a running
  `tbd web` leaves the caller worktree, sync refs, `FETCH_HEAD`, hidden worktree, and
  lock untouched except for the pull a wake performs.
- [x] Packaged proof via `pnpm --filter get-tbd qa:web-package`: the tarball carries
  `dist/web/index.html`, its published launcher starts exactly once, and the extracted
  package serves its page and APIs before clean SIGTERM shutdown.
- [ ] Manual/CI pass on macOS plus one other platform.
  The macOS pass on this repository covers operator-readable output, search and ancestor
  context, lazy detail expansion, light/dark/system themes, responsive layout, CSP, and
  a clean browser console; the second platform is supplied by the final CI matrix.
- [x] Current `origin/main` merged cleanly after the local release gate.
- [x] PR description updated to the shipped reality.

### Final review finding map

The final review is tracked under `tbd-o7nu`. Every implementation finding has one bead
and one code seam; all thirteen are implemented and locally validated.
R13 removes the remaining shell-specific syntax exposed by the Windows matrix.

| Bead | Severity | File/function seam | Disposition |
| --- | --- | --- | --- |
| `tbd-x8g8` (R1) | P2 | `src/web/core.ts`: `Store.fetchBody`, `bodyRequestIsCurrent` | Gate stale success and error responses on request token plus data generation; regression covers the unresolved PR thread. |
| `tbd-b3a3` (R2) | P2 | `src/web/core.ts`: `loadBody`, `drainBodyQueue`, `pruneBodyQueue` | Limit detail fetches to eight and discard collapsed queued work. |
| `tbd-3w9e` (R3) | P1 | `scripts/copy-docs.mjs`: postbuild `dist/tbd` launcher | Import canonical `bin.mjs` instead of copying it as a second ESM identity; tryscript proves one action/descriptor. |
| `tbd-oi4e` (R4) | P1 | `src/cli/web/wake.ts`: `runRemoteWatchLoop`, `handleWatchFailure` | Retry a failed report from the same cursor; reset only after a proven non-ancestor rewrite. |
| `tbd-t7to` (R5) | P1 | `src/file/sync-run.ts`: `runIssueSync`; `src/cli/web/wake.ts`: `applyReport` | Use no-prompt bounded fetch plus the shutdown signal for embedded pulls, without changing interactive sync behavior. |
| `tbd-urft` (R6) | P2 | `src/cli/commands/web.ts`: `WebHandler.run` | Run idempotent full teardown after either a signal or listener-first close. |
| `tbd-t6gm` (R7) | P1 | `src/cli/web/board.ts`: `PUBLIC_ID`, `BoardState.getBead` | Accept canonical dot/underscore/hyphen display IDs while rejecting option-shaped input. |
| `tbd-rmvx` (R8) | P2 | `tests/rescue-divergence.test.ts`: true-conflict rescue integration | Give the Git/subprocess integration case an explicit timeout after it passed alone in 0.7 seconds but reached 8.4 seconds under the full parallel suite. |
| `tbd-ijz7` (R9) | P2 | `tests/cli-setup.tryscript.md`: top-level help golden | Pin `web` in the complete command listing as well as its dedicated help transcript. |
| `tbd-b4m2` (R10) | P1 | five `tests/cli-sync-*.tryscript.md` fixtures: `before` remotes | Keep each bare remote inside its sandbox’s own Git directory so sync histories cannot leak between transcript files. |
| `tbd-snb4` (R11) | P1 | `tests/cli-web.tryscript.md`: built CLI invocation | Invoke `bin.mjs` explicitly with Node so the focused matrix transcript does not depend on Unix extensionless-command lookup. |
| `tbd-qf41` (R12) | P1 | `src/cli/web/wake.ts`: `applyReport`; `tests/web-wake.test.ts` | Treat `remote-missing` as a retryable unapplied report: do not reload or advance report/cursor state, and retry from the same baseline. |
| `tbd-4ets` (R13) | P1 | `tests/run-built-cli.mjs`; `tests/cli-web.tryscript.md`: sandbox invocation and filters | Resolve the built entry through Node’s environment instead of shell expansion, and use shell-neutral quoting for `sed`/`jq`. |

### Merge gate for PR #207

All of the following, verified in the PR before merge — the PR stays in draft until they
hold:

1. Every phase checklist above complete.
2. CI green on the final head across all three platforms; publint and package-age clean;
   no new runtime dependency.
3. The packaged-tarball proof (Phase 6) recorded in the PR.
4. Spike scripts gone; no dead flag or dormant mutation code shipped.
5. Docs complete: design doc (including the §1.6 amendment), manual, help text,
   CHANGELOG.
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
  `fetch`/`EventSource` stubs — connect-then-fetch ordering, SSE resume via
  `Last-Event-ID`, wake coalescing, delta gating on `reportDataVersion`, and
  query-string round-tripping — following metabrowser’s stubbed-window test pattern.
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

Resolved by the owner’s 2026-08-10 productionization direction:

- `tbd web` ships in core through PR #207, which merges only production-ready; no
  separate package.

- The §1.6 amendment is in scope for this PR and reviewed in its diff.

- The watch runs in-process behind the new `AbortSignal`; the spike’s child process was
  scaffolding and retires in Phase 3.

- v1 is read-only; the mutation route is removed, not hidden (see Writes).

- The remote watch selection is `--all`; add a selector only if production usage shows
  poll-cost pressure.

- The core refactors ride PR #207 rather than landing through separate cherry-picks.

## References

- `plan-2026-07-19-bead-watch-and-external-sync.md` — the watch contract this builds on
- `valid-2026-08-09-bead-watch-release.md` — isolation and resource assertions to reuse
- `packages/tbd/docs/tbd-design.md` §1.5, §1.6, §1.7, §4.10, §4.12
- `packages/tbd/src/lib/issue-selection.ts` — the existing shared predicates
- `packages/tbd/src/cli/lib/tree-view.ts` — `buildIssueTree` and the `tbd-5hh1` defect
- PR #207’s Phase 1 commits — retired spike evidence and review history
- `github.com/jlevy/metabrowser` — `src/metabrowser/sse.py` for cursor-as-event-id and
  bounded frames; `src/metabrowser/static/styles.css` for flash and reduced-motion;
  `src/metabrowser/cli/serve.py` for readiness-gated auto-open, port-range search, and
  SSE-aware shutdown with suppressed cancellation noise; `tests/dom/` for the
  stubbed-window, jsdom-free client behavior tests; `tsconfig.json`/`biome.json` for the
  client QA floor this plan matches and exceeds
- Beads: `tbd-5hh1` (tree depth), `tbd-q5c7` (stdout JSON contract), `tbd-w5xi`
  (`--due`)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
