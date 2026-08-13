# get-tbd

## Unreleased

### Added

- **External tracker integrations** (`tbd integration`), with Linear as the first
  provider: a one-way outbound projection plus full bidirectional synchronization,
  governed by a per-integration linking policy (`outbound` / `inbound` / `field_sync`
  clauses, `policy: default` preset).
  - `tbd integration sync` takes the same direction flags as `tbd sync` — bare is both
    directions, `--push` is outbound only, `--pull` is inbound only — so the vocabulary
    is identical across every surface.
    `--pull --external <ref...>` creates exactly named inbound beads independent of the
    policy; it remains externally read-only.
  - Plain `tbd sync` now covers docs, issues, **and** enabled trackers.
    Surfaces run independently and failures roll up: one surface failing (an expired
    credential, an unreachable remote) never stops another, and nothing a working
    surface would have saved is lost.
    Narrow with `--docs`, `--issues`, or `--integrations`.
  - Comments sync as append-only sequences; conflicts archive to the attic and post
    resolvable tracker comments; bulk changes over 20 creates / 40 updates require
    `--yes` and are refused non-interactively.
  - Strictly additive: repositories without an `integrations` config block are
    unaffected, links ride each bead’s `extensions` namespace, and there is no format
    bump.
  - `tbd integration status` reports whether each provider is configured, credentialed,
    and reachable, with a remedy on every failure.
    Inert and offline when none is enabled.
  - `tbd integration sync --push` projects selected beads outward.
    Accepts the same selectors as `list` (`--bead`, `--type`, `--status`, `--label`,
    `--spec`) plus `--limit`, so a rollout can be staged without editing config.
    Idempotent: re-running updates in place.
  - Runs above 20 creates or 40 updates require affirmation.
    Without a terminal the run is refused rather than prompted, so CI never hangs and
    never silently makes a large change.
    `--yes` proceeds.
  - Credentials load from the environment or a gitignored `.env`. An unignored `.env` is
    reported as an error.
- An `integrations` config block.
  **No format bump and no schema change**: the bead’s link is stored in the existing
  `extensions.<provider>` namespace, which an older tbd round-trips untouched.
  A top-level field would have been silently stripped on the first write from an older
  CLI, which is what forces a format gate; using the namespace keeps the feature
  additive and mixed-version safe.
- `tbd doctor` gains hierarchy and integration checks.

### Fixed

- Every display prefix accepted by `init` and `setup --force` (including digits, dots,
  and underscores) is now parsed by issue and integration commands.
  Exact imported short IDs win before prefix stripping, preserving short IDs that
  contain hyphens.
- Sync and doctor now detect pre-existing multiple-beads-to-one-external-item links.
  Every holder fails closed before journal replay or provider writes, with an unlink
  remedy, while unrelated linked pairs continue to converge.
  Ambiguous pending writes are discarded so a stale former holder cannot replay after
  repair.
- Link and inbound creation now probe `tbd://bead/…` attachment claims before allowing a
  second repository to bind the same tracker item; `--force` is the deliberate stale-
  claim override. Manual links persist their bead link, bridge base, and attachment
  intent before the provider write, so a failed claim upsert replays safely.
- `tbd integration sync --pull` no longer replays provider-write journals or writes an
  inbound bead attachment.
  Every inbound ownership claim is journaled before provider I/O, so an attachment
  failure retries without creating a duplicate bead; pull-only claims and conflict
  notices remain local and post exactly once on the next full sync.
- Malformed or unreadable integration intent journals now fail synchronization closed
  with the damaged filename instead of silently discarding the client UUID that prevents
  duplicate external creation.
- Every replayed provider write now carries its owning bead id and requires the current
  bead to retain the exact provider relationship; comments additionally require their
  unpushed local entry.
  New creates persist their client UUID as a provisional link before provider I/O. A
  matching durable create intent now keeps a confirmed-absent relationship pending
  rather than misreporting it as orphaned, including under `--pull`; an already-live
  item still reconciles while follow-up journal work remains.
  If that work failed before the first bridge record, the journaled creation snapshot
  supplies the three-way base, so intervening tracker edits pull or conflict correctly
  rather than being overwritten.
  Enriching the provisional link preserves comments and future provider-namespace
  siblings. Unlink cancels pending writes before clearing that identity and keeps the
  bridge record until cleanup finishes, so failures remain retryable and a stale or
  cross-machine journal cannot write after unlink or pin future synchronization.
- Top-level `tbd sync --push` now uses the same outbound-only tracker projection as
  `tbd integration sync --push`; it no longer runs bidirectional reconciliation and pull
  remote tracker edits under a push-only command.
- Folded tracker item failures and integration config parse/read failures now propagate
  to `tbd sync`’s aggregate non-zero exit status after independent docs and issue work
  completes, instead of being reduced to a warning or silently treated as inert config.
- Tracker conflicts now archive the exact losing value before either side is overwritten
  and journal the conflict comment with its archive path.
  Crash replay reuses both.
- Attic list/show/restore now accept mapped display IDs and real base32 ULID filenames,
  decode canonical JSON text without breaking legacy entries, and reverse-archive the
  displaced winner before a restore.
- Linked Linear issues are liveness-checked even outside the update watermark, so an
  archive or deletion marks the link orphaned without deleting or closing the bead.
- `extensions` merged as one opaque last-writer-wins value, so two writers touching
  different namespaces silently lost one side.
  Now merged per namespace.
- Nothing prevented a `parent_id` cycle, which makes every ancestor walk
  non-terminating. Now rejected on the write path, with a `doctor` check for existing
  data.
- The `engines` floor was `>=20` while `util.parseEnv` needs 20.12, so `.env` reading
  would have thrown at runtime on 20.0-20.11.

### Changed

- `kind` moved into the shared issue filter, so `list`, `changes`, and `watch` evaluate
  it identically.

## 0.5.0

### Features

- **Read-only bead change detection and watching**: `tbd changes` reports deterministic,
  per-field deltas between committed sync-branch snapshots, while `tbd watch` polls the
  configured remote tip and exits when a bead, dynamic filter, ready set, or the whole
  graph changes. Both commands share human and stable JSON reports and one exit-code
  contract: 0 matched, 3 nothing matched (no deltas, or a `--timeout` that elapsed
  without any), 2 usage error, 1 operational failure.
  Because 3 and 2 are distinct, an agent wake loop can retry on “nothing matched”
  without spinning on a mistyped flag.
- **Live local bead view**: `tbd web` serves a responsive, read-only view of the bead
  graph on loopback and refreshes from local file changes.
  Installed agent skills route requests such as “Show my beads in a browser” to
  `tbd web --open`; the agent starts and keeps alive the viewer, performs every bead
  mutation with ordinary `tbd` commands, and lets the page reflect those changes.
  The page and startup output explicitly identify it as a viewer, not an editor.
  It never contacts a remote; ordinary `tbd sync` remains the explicit
  fetch/merge/publish contract, and its local result appears automatically.
  Its filters, default priority order, readiness rules, hierarchy, statistics, and
  displayed command line come from the same implementations as the CLI; browser-only
  column composition is identified as inexact beside that command.
  Native filesystem events normally redraw immediately; a one-second constant-size
  metadata check repairs missed events without reloading an unchanged graph.
  The client lazy-loads bead bodies and bounds requests and rendered rows for large
  repositories. Counted multi-label filtering, relative update ages, four-line collapsed
  titles, and composable sortable column headers keep dense boards scannable.
  Label-menu search drafts survive live rerenders, and Home/End retain native
  text-editing behavior while the search field owns focus.
  Sorting never disables Pretty: it reorders outermost tree groups while official child
  order remains intact; flat mode applies the same stack to individual rows.
  An optional repository-or-subdirectory path makes the viewer usable from any working
  directory. Initialized repositories with zero beads render a normal empty board;
  missing or uninitialized bases fail with the standard clear CLI errors.
  `--open` is opt-in; JSON and dry-run modes support agents and CI.

### Guidelines and content

- **Agent wake recipes**: the new `watch-beads` shortcut documents a durable, race-safe
  watch-then-spawn worker loop plus bounded and background in-session patterns for
  Claude Code and Codex.
  Live validation covers both platforms coordinating through one bead.
- **Browser requests route to the viewer**: the installed skill tiers and welcome
  guidance teach agents to start `tbd web --open` (or `tbd web <path> --open`), keep the
  foreground process alive, and make every bead mutation with ordinary tbd commands.
  The viewer never implies an edit or remote sync.
- **Engineering checks require a named benefit**: the General engineering guidance now
  rejects cryptographic hash checks and other process ceremony unless they cross a real
  trust boundary and catch a specific failure.
- **GitHub CLI guidance tests actual egress**: `setup-github-cli` now distinguishes
  direct GitHub access from mediated proxy channels and documents the scoped,
  TLS-preserving `NO_PROXY` path when direct egress is available.

### Documentation

- **`changes` and `watch` are documented in the built-in docs**: the CLI manual
  (`tbd docs`) is authoritative for selectors, baseline commits, the report format, and
  the repo-wide exit codes, and the design doc adds §3.7 (read-only remote observation:
  private refs, fetch-flag isolation, bounded network calls) and §4.14 (the command
  contract, selection semantics, and watch loop).
  The `watch-beads` shortcut now carries the recipes and platform notes rather than
  restating the contract.
- **Notes semantics documented where they are used**: the manual’s `update` section
  states that `--notes` replaces the whole body and that notes are single-writer
  replaceable state, not a conversation log.

### Fixes

- **Watch exit codes disambiguated**: a watch timeout now exits 3, matching the
  `tbd changes` no-change code, so exit 2 always means a usage error and recipes that
  retry on “nothing happened” can never loop on a bad invocation.
- **Centralized exit-code contract**: success (0), operational failure (1), usage error
  (2), no matching change (3), and SIGINT (130) now live in one shared module used by
  errors, commands, and the binary entry point.
- **Watch rides out brief outages**: an established watch tolerates a bounded run of
  consecutive failed remote polls (each failed poll waits the normal interval) before
  exiting 1; startup validation still fails fast.
  Baseline-invalidation and stale-snapshot errors now carry recovery hints (restart
  without `--since`; run `tbd sync` first).
- **Watch deadlines are observable and bounded**: timeout completion now includes one
  final remote-tip observation, and each network observation/fetch has an explicit
  poll-interval wall-time budget capped at 30 seconds.
- **Stable report contract**: substantive field coverage in change/watch reports is
  compile-time exhaustive, and pathological text rewrites report
  `hunks_omitted: "complexity_limit"` instead of growing an unbounded Myers trace.
  Like every other tbd `--json` surface, the report evolves by addition only.
- **Durable worker recipe**: `watch-beads` persists a pending report before spawning,
  pulls and revalidates current state, fails closed on worker/sync errors, and advances
  its checkpoint only after success.
  The shortcut now states the actual `--notes` replacement semantics and recommends
  child beads or external comments for durable multi-writer history.
- **Watch review hardening**: explicit bead IDs are validated before an unbounded poll,
  fresh-clone errors point to `tbd sync`, empty spec filters retain list-compatible
  behavior, created/deleted reports omit null-to-null fields, and text hunks retain at
  most three context lines.
- **Bounded snapshot subprocesses**: committed issue blobs are read through bounded
  128-object `git cat-file --batch` groups instead of one `git show` per issue or one
  graph-sized child-output buffer.
- **Web final-review hardening**: the viewer has one local-only contract and no poll
  flag or implicit remote sync; native and reconciliation observation degrade
  independently; listener-first shutdown still tears down the observer and SSE clients;
  changed-row motion remains complete while local field detail is bounded; config-only
  updates are published and ordered by an observer-local state version; browser clients
  reject stale equal-graph-version responses, keep canonical board state over delayed
  same-version event duplicates, and recover across an observer restart; ref rewinds
  resume from the newest matching event; a stream high-water signal no longer drops a
  client before the explicit queued-byte ceiling, while a write-time closed stream is
  isolated to that client; stale detail failures cannot overwrite a newer generation;
  detail fetches have an eight-request ceiling; and canonical display IDs containing
  dots, underscores, or hyphens are accepted by the detail API.
- **Web snapshot concurrency is fail-closed**: every standard shared-data writer now
  brackets its transaction with a persistent active/quiescent epoch under the existing
  repository mutex. The viewer publishes a privately staged graph only when the same
  quiescent epoch and an absent mutex bracket the complete read, so create, update,
  doctor repair, and sync bursts can expose the complete state before or after a write
  but never a torn mixture.
  Writer locks retain the established portable mkdir election, atomically install a
  fully prepared non-empty process-owner generation without hard links or successor
  overwrite, treat heartbeat touching as advisory rather than ownership, retain
  generation-specific stale quarantines to prevent ABA recovery races, and move verified
  releases out of the canonical path before cleanup.
  Owner installation now fingerprints its provisional directory and classifies a raced
  parent removal by generation identity, covering macOS `EINVAL` without masking a
  persistent same-generation filesystem error or overwriting an installed replacement.
  Shared-lock permission diagnostics and the doctor probe cover the complete owner
  preparation/install lifecycle without relabeling unrelated critical-section errors.
  Reload, SSE, and browser queues are coalesced or explicitly bounded, with shutdown and
  stale-response cancellation.

### Security

- No dependencies were added or upgraded, and `pnpm-lock.yaml` is byte-identical to
  v0.4.2. The 14-day package-age gate reports zero violations.
  The full audit’s other findings are confined to development tooling that is not
  installed for package consumers; its critical Vitest advisory requires the optional UI
  server, which this repository neither installs nor starts.
  Watch fetches only after remote movement, targets a collision-resistant private ref,
  does not write `FETCH_HEAD` or configured sync refs, never accesses the hidden
  data-sync worktree or lock, removes its private ref on normal completion (best-effort,
  so a failed delete can never discard the change report), and reclaims refs orphaned by
  interrupted watcher processes on the next watch startup.
- `tbd web` binds only `127.0.0.1`, validates Host and same-origin Origin headers,
  accepts no mutation route, never performs network synchronization, serves a
  restrictive Content Security Policy, caps SSE frames and replay buffers, drops
  backpressured clients, and closes open streams on a bounded shutdown.
- **YAML-only front-matter boundary**: every tbd gray-matter call now uses one
  centralized engine configuration backed by the existing `yaml` package and rejects
  explicit non-YAML language markers before parser dispatch.
  This preserves gray-matter’s delimiter behavior, keeps date-looking YAML scalars as
  strings across LF and CRLF checkouts, keeps its default `js-yaml` resolver out of
  every tbd parsing path, and makes the library’s built-in JavaScript evaluator
  unreachable from synchronized issue or document files.
  On document and skill paths, YAML 1.2 keeps date-looking and sexagesimal-looking
  scalars as strings, interprets leading-zero integers as decimal rather than legacy
  octal, and continues to keep `yes`/`no`/`on`/`off` as strings.
  The shipped `gray-matter → js-yaml` advisory is availability-only and remains visible
  to `pnpm audit --prod`, but its vulnerable `!!omap` resolver is not reachable through
  tbd. The patched transitive release remains inside the repository’s 14-day dependency
  cooldown at release preparation time.

**Full commit history**:
[https://github.com/jlevy/tbd/compare/v0.4.2 … v0.5.0](https://github.com/jlevy/tbd/compare/v0.4.2...v0.5.0)

## 0.4.2

### Features

- **Bulk `tbd show`**: `show` now takes multiple IDs.
  Each issue renders under a dim `── <id> ──` delimiter in argument order, parent
  context is suppressed in bulk, `--max-lines` applies per issue, and `--json` emits an
  array (single-ID shapes are unchanged).
  Unknown IDs fail closed listing every bad ID; `--ignore-missing` renders the found
  subset and reports skips on stderr, with `--json` stdout staying parseable when
  everything is skipped (`[]` in bulk, `null` for a lone ID).
- **Doc readers load several docs in one call**: `guidelines`, `shortcut`, `template`,
  and `docs show` all accept multiple names, resolving all-or-nothing (a typo can’t
  half-load a guideline group) with the agent preamble printed once.
  Loading the General-engineering group is now one command.
- **Dependency wiring in one call**: `dep add`/`dep remove` take multiple blockers
  (`tbd dep add <issue> <b1> <b2> …`), and `create --depends-on <id>` (repeatable)
  declares blockers at creation, so a spec breakdown creates fully wired beads.
  Multi-file dependency writes report per-target outcomes on failure: applied edges are
  named and kept, the exact finishing command is given, and a `create` whose blocker
  wiring fails still reveals the created ID so a retry cannot duplicate the bead.
- **Write-side `--spec` matches like `list --spec`**: `create --spec` and
  `update --spec` resolve a unique filename or path suffix against `docs/` (ambiguity
  errors name every candidate), so the filename-only form the planning shortcuts
  document actually works.
- **Errors recover the agent**: unknown-ID errors suggest near-miss IDs ("Did you mean:
  …?") when one is close; `tbd search` matches display IDs (partial-ID lookup is
  native); and `tbd create` with too many arguments explains the one-title contract.
- **Agent docs advertise the bulk/filter forms at point of need**: the skill tables,
  `tbd prime`, and the manual now show multi-ID `show`, `list --spec/--specs`,
  `--limit/--count/--sort updated/--max-lines`, bulk labeling via `update --add-label`,
  and a generalized never-loop rule; the jq/grep recipes in `update-specs-status` and
  the manual’s ID-lookup troubleshooting are replaced with native commands.

### Guidelines and content

- **New `typescript-lint-format-rules` guideline**: one normative lint, format, and
  type-check floor for every TypeScript and JavaScript project, organized as a
  three-axis decision matrix (package manager, language, and lint engine are independent
  choices, with a complete path for every combination).
  It prescribes typescript-eslint `strictTypeChecked` plus `stylisticTypeChecked` as the
  new-project default, an explicit tsconfig floor beyond `strict: true`, zero-warning
  verify gates (`eslint --max-warnings 0`, `biome ci --error-on-warnings`), a full
  verify-only gate (formatter and flowmark checks before lint, types, and tests) in
  pre-push and CI, and an honest promise-safety story: Biome’s nursery type-domain rules
  for TypeScript, and a minimal type-aware ESLint overlay for checked JavaScript.
  The skill baseline and both code-review shortcuts now route TypeScript/JavaScript work
  through the guideline.
  `pnpm-monorepo-patterns` Appendix C implements the strict presets and documents the
  eslint-config-prettier ordering trap (its list includes `curly`, so explicit project
  rules must come after the prettier entry, verified via `eslint --print-config`), and
  `bun-monorepo-patterns` adds the `useBlockStatements` braces floor that Biome’s
  recommended preset omits plus the explicit nursery promise rules.
  This repository applies the same floor: strict presets with two tracked ratchets, the
  new tsconfig flags, sequential pre-commit hooks, a `ci:quality` verify gate in
  pre-push and CI (including the flowmark Markdown check), and a committed ESLint
  config-contract check that fails CI if a floor rule goes dead.
- **`setup-github-cli` shortcut covers proxied remote sessions**: new session-validated
  guidance for agent environments that route HTTPS through a policy proxy (Claude Code
  Cloud and similar). The git credential broker is ref-scoped: branch pushes succeed
  while tag pushes are refused, ref deletions can silently no-op, and a clean
  `git push --dry-run` proves nothing.
  `gh auth status` can report a valid `GH_TOKEN` as invalid when the proxy intercepts
  GraphQL. The documented remedy is a scoped `NO_PROXY` bypass for GitHub hosts plus
  `gh api` for ref operations, with TLS verification always left on.

### Security

- **js-yaml advisories resolved**: the runtime parser path (`gray-matter > js-yaml`)
  moves from 3.14.2 to 3.15.0, closing GHSA-h67p-54hq-rp68 (moderate) and
  GHSA-52cp-r559-cp3m (high, published 2026-07-20, after v0.4.1 shipped), both
  quadratic-CPU DoS via YAML merge keys; the dev-only eslint path moves from 4.1.1 to
  4.3.0. Both bumps are the upstream `maxTotalMergeKeys` backports published 2026-06-26
  by the long-time maintainer (past the 14-day cool-off, diff reviewed), the lockfile
  delta is confined to js-yaml, and `pnpm audit --prod` is now clean.
  This closes tbd-zqn2, deferred since v0.4.0. Remaining advisories are confined to dev
  tooling (vite, vitest, eslint chains) and are not shipped to users.

**Full commit history**:
[https://github.com/jlevy/tbd/compare/v0.4.1 … v0.4.2](https://github.com/jlevy/tbd/compare/v0.4.1...v0.4.2)

## 0.4.1

### Fixes

- **`tbd setup --auto --dry-run` is now strictly read-only**: a dry run previews
  migrations, docs sync, legacy cleanup, and every surface refresh while leaving
  tracked, untracked, ignored, and shared git-common-dir state byte-for-byte unchanged.
- **Setup no longer overwrites files it does not manage**: if a skill path holds a
  user-authored file (no tbd marker), setup stops with an explicit error instead of
  replacing it, and a file generated by a newer tbd is refused before any write.
- **`tbd doctor` now detects drift in managed agent surfaces**: skills, `AGENTS.md`, and
  Codex hooks are each reported as current, stale, missing, user-owned, or too-new, with
  the exact `tbd setup --auto --surfaces=<surface>` remedy per finding, and doctor stays
  read-only while checking.

### Guidelines and content

- **`cli-agent-skill-patterns` rewritten as a concise decision guide** (from a
  1,594-line manual to a 358-line orientation core) with three new on-demand references
  served by `tbd docs show`: `agent-skill-bundle-publication`,
  `agent-skill-distribution`, and `agent-platform-integration`. Guidance is verified
  against current (July 2026) Claude Code and Codex documentation: skill locations and
  shadowing, turn-scoped `allowed-tools` semantics, plugin distribution for both
  platforms, the `gh skill` installer, hook trust flows, and the Codex docs migration to
  learn.chatgpt.com.
- **Generated tbd skill frontmatter uses the portable spec form**:
  `allowed-tools: Bash(tbd:*) Read Write` (space-separated), with a tighter skill
  description.
- **Bundled docs pass a common-doc-guidelines sweep**: consistent title-case headings,
  conjunctions written out, present-state phrasing, and removal of filler across
  guidelines, templates, and references.

### Documentation

- **Release process clarified**: choose the version bump by the substance of the
  user-facing change, not the commit-type label; a `feat`-labeled commit whose payload
  is docs or guidance content is a patch.
  `publishing.md` also covers OIDC trusted publishing and release stall recovery.

### Security

- No dependency changes: the lockfile is byte-identical to v0.4.0 and
  `pnpm check:package-age` has nothing new to review.
  The js-yaml advisory noted in v0.4.0 remains open upstream and tracked as tbd-zqn2.

**Full commit history**:
[https://github.com/jlevy/tbd/compare/v0.4.0 … v0.4.1](https://github.com/jlevy/tbd/compare/v0.4.0...v0.4.1)

## 0.4.0

### Features

- **Bulk close/reopen/update (agent CLI ergonomics Phase 1)**: `close`, `reopen`, and
  `update` now accept multiple IDs and process them under one repository lock, printing
  a single summary line (or a structured `--json` `{ results, summary, sync }` object,
  with `sync` always present) plus a visible unsynced-changes hint.
  Validation is fail-closed: unknown IDs abort the batch before any write, and
  unreadable or corrupt issue files always abort, even with `--ignore-missing` (which
  downgrades only genuinely absent issues to reported skips).
  Duplicate IDs are processed once; results are reported in argv order; a write failure
  mid-batch is reported as a `failed` result in the summary, each failed ID and error is
  named on stderr, and the command exits non-zero.
  `--dry-run` previews after resolution, reads, and state checks, so it reflects exactly
  what a real run would write.
  Single-ID command behavior is unchanged.
- **Body input from files and stdin**: free-text bodies (`--reason`/`--reason-file`,
  `-d`, `--notes`/`--notes-file`) accept `-` to read stdin, so shell-sensitive text no
  longer needs careful quoting.
  An interactive terminal gets an explicit “press Ctrl+D to finish” hint before any
  blocking read, and asking two flags to read stdin at once is rejected up front.
- **Fully silent `--quiet`**: on success, `--quiet` now also suppresses incidental
  worktree-heal and config-migration notices, so scripted callers get clean output.

### Fixes

- **Notes-only issues round-trip**: an issue with working notes but no description now
  parses correctly; previously the `## Notes` section was folded into the description on
  read, silently losing the notes and duplicating the section on the next write.
- **Windows lock acquisition**: transient `EPERM` from `mkdir` during lock acquisition
  is retried within a bounded window, so concurrent tbd invocations on Windows no longer
  fail spuriously while real permission errors still surface immediately.
- **Session-closing reminder hook**: `tbd setup` now generates a hook that survives real
  checkouts — invoked via `bash` (no reliance on the executable bit), resolves the repo
  root with `git rev-parse` (fires from subdirectories), and falls back to a pinned
  `npx` tbd when the CLI is not on the hook’s `PATH`. Re-running `tbd setup --auto`
  replaces an existing hook entry instead of skipping it.

### Guidelines and content

- **PR review lifecycle shortcuts**: new `pr-review-workflows` (how reviews are created,
  published, and addressed across channels) and `address-pr-review` (address a received
  review, tracking every finding to a fixed/rebutted/deferred disposition);
  `review-github-pr` is now focused on reviewing and publishing to a chosen channel.
- **`update-specs-status` rewritten** as a full tracking reconcile: beads, active plan
  specs, and the top-level work index are checked against reality and each other, with
  explicit consistency validation.
- **Bulk-operation guidance for agents**: the tbd skill, `tbd prime`, the closing
  checklist, and the batch shortcuts now teach the bulk verbs — group beads that share a
  mutation and reason into one call — and explicitly warn against per-ID shell loops.
- **Assorted shortcut fixes**: doc-fork close-out corrections, session-closing
  discipline and branch-state checks, GitHub CLI setup in `merge-upstream`, and
  de-hardcoded npm commands.

### BREAKING

- The global `--no-sync` flag has been **removed** and is now rejected at option
  parsing. It was a no-op for issue writes (no mutator ever read it), but scripts passing
  it must drop the flag: writes always stage locally and `tbd sync` publishes.

### Security

- The lockfile is byte-identical to v0.3.0: no dependencies were added, removed, or
  bumped; `pnpm check:package-age` passes with 0 violations.
  One new moderate advisory was published against the unchanged tree:
  quadratic-complexity DoS in `js-yaml` <3.15.0 merge-key handling
  ([GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68), reached via
  `gray-matter`). No patched 3.x release exists on npm yet; exposure requires
  adversarial YAML front matter in repo-local issue files and the impact is slow
  parsing, not code execution.
  Tracked as tbd-zqn2 for resolution when a safe upgrade path exists.

**Full commit history**:
[https://github.com/jlevy/tbd/compare/v0.3.0 … v0.4.0](https://github.com/jlevy/tbd/compare/v0.3.0...v0.4.0)

## 0.3.0

The headline is **forkable docs**: every doc tbd serves (guidelines, shortcuts,
templates, and the new reference docs) can now be forked into your repo as visible,
git-tracked files, edited in place, and reconciled with upstream after upgrades.
The repository format bumps `f04` → `f06` in this release: `f05` adds the forkable-docs
layout, and `f06` adds a config upgrade history and redefines `tbd_version`. Both
migrations are metadata-only (they update `tbd_format` in `.tbd/config.yml` and refresh
generated metadata; fork artifacts appear only when you first fork something), so
upgrading is safe and revertible.

### Features

- **Forkable docs** (`tbd docs fork` / `unfork` / `update` / `diff` / `status`): fork
  any managed doc into a visible fork dir (`docs/tbd/`, laid out by kind with a
  generated `README.md` index, tracked in git).
  Your copy shadows the hidden cache everywhere the doc is served; forking changes
  nothing about how docs work — it only makes them explicit and editable.
  - `tbd docs update` three-way merges upstream changes into your copies after an
    upgrade: `--merge` combines and writes conflict markers to resolve, `--keep-ours`
    keeps your version and advances the fork point; `--dry-run` previews and lists
    conflicts.
  - `tbd docs diff <name>` compares your copy against upstream (default), against its
    recorded base (`--base`, what you changed), or base against upstream (`--upstream`,
    incoming changes).
  - `tbd docs status` reports every fork’s state (`forked`, `customized`, `conflicted`,
    `missing`, plus `local` for your own files in the fork dir).
    States are recomputed from content hashes — no git operation can desynchronize
    tracking. Fork state lives in the committed `.tbd/doc-forks/` (a `forks.yml` manifest
    plus `base/` snapshots); the fork dir itself stays outside `.tbd/`.
- **The `tbd docs` surface is re-homed around managed docs**: bare `tbd docs` is now the
  status overview, and `tbd docs list` lists all docs across kinds with
  `[forked]`/`[customized]`/`[local]` markers.
  The CLI manual moved to `tbd docs show tbd-docs` (alias: `tbd docs manual`); the old
  `tbd docs --list` / `--all` / `--section` flags are retired in favor of
  `tbd docs show tbd-docs --sections` / `--section <name>`. `tbd docs show <name>` reads
  any doc by name, kind-agnostically.
  `tbd docs sync` refreshes the gitignored docs cache (`tbd sync --docs` remains as a
  deprecated alias).
- **docref + docmap formats, and a new `reference` doc kind**: every doc source is
  addressed by a **docref** — one URI-like grammar (`internal:…`, anchored local paths,
  URLs, `github:owner/repo@ref//path`) used for `docs_cache.files` values and
  fork-manifest `source` values alike — and every doc listing is one **docmap**
  (`docmap/0.1`) rendered as text or `--json`: `tbd docs list` / `tbd docs status`, the
  bare-`tbd docs` overview, and the per-kind `--list` (whose `--json` output changes
  from a flat array to a docmap).
  Both formats ship as docs of the new `reference` kind — read them with
  `tbd docs show docref-format` and `tbd docs show docmap-format` — alongside the manual
  (`tbd-docs`) and design doc (`tbd-design`), which are now managed docs too.
- **Fork drift is visible, never auto-fixed**: `tbd status` gains a `Docs:` line when
  forks exist (forked/customized counts, pending upstream updates, conflicts, missing
  files), and `tbd sync` prints a one-line notice when forked docs are stale,
  conflicted, or missing.
  Only the explicit `tbd docs update` ever modifies tracked files.
- **Config upgrade history** (format `f06`): `tbd_version` in `.tbd/config.yml` now
  records the version that last ran `tbd setup` (previously frozen at install time), and
  a new `tbd_upgrades` list records, oldest-first, the versions that have run setup in
  the repo. Both are informational (functional gating stays on `tbd_format`);
  `tbd config show` displays the history.
  The `f05 → f06` migration seeds the first entry from the prior `tbd_version`, and each
  setup appends the running version when it changes.

### Guidelines and content

These ship inside the package and are read by agents via `tbd docs show …`,
`tbd shortcut …`, and `tbd setup`:

- **New `suggest-upstream-improvements` shortcut**: the playbook for reviewing fork
  customizations (`tbd docs status --json`, `tbd docs diff <name> --base`), deciding
  what generalizes, contributing it upstream, and re-syncing with `tbd docs update` once
  merged.
- **New `docref-format` and `docmap-format` reference docs**: the specifications for the
  two formats above, forkable like any other doc.
- **Onboarding and agent surface updated for forkable docs**: `welcome-user` now makes
  the two-axis offer (scope: all standard guidelines or a stack subset; visibility:
  hidden cache or forked into `docs/tbd/`), and the agent skill routes fork, update, and
  missing-file requests to the new commands.
- **`cli-agent-skill-patterns` guideline expanded** (issues #173, #175): names the L2b
  self-installing-tool variant and spells out how a self-installer should upgrade its
  managed generated artifacts deliberately, bake a pin its generator can actually
  resolve, and stamp the format/forward-compatibility guard; plus Cursor native skill
  paths and tightened upgrade-scope guidance.
- **`checkout-third-party-repo` shortcut reuses an existing checkout** (#168): it now
  updates an existing `attic/<repo>` (with a clean-check and detached-HEAD/tag handling)
  instead of re-cloning into an existing directory or working from a stale checkout.
- **Every bundled guideline now declares a `category` in its frontmatter**, so
  `tbd docs list` and the docmap listings group guidelines consistently.

### Security

Lockfile unchanged since v0.2.3; the resolved dependency tree is byte-identical (same
`pnpm-lock.yaml` hash) and there are no manifest changes, so no new advisories.
`pnpm audit --prod` reports no known vulnerabilities.

**Full commit history**:
[https://github.com/jlevy/tbd/compare/v0.2.3 … v0.3.0](https://github.com/jlevy/tbd/compare/v0.2.3...v0.3.0)

## 0.2.3

A drop-in patch on top of v0.2.2. **No on-disk format change** (`f04` stays `f04`), so
any machine already on v0.2.0 or later can upgrade without a migration.
The headline is hardened issue sync — a structured, field-level three-way merge of
issues that no longer loses child wiring or silently corrupts data — plus a new
`tbd doctor` check for an unwritable shared lock in agent sandboxes.

### Features

- **`tbd doctor` detects an unwritable shared data-sync lock**: every write command
  (`create`, `update`, `sync`) must take a repo-scoped lock under the Git common dir.
  When that path is not writable — common in agent sandboxes such as Codex worktrees,
  where the common dir lives outside the writable checkout — read-only commands still
  work but every write fails.
  Doctor now probes this up front and reports it as a hard error with sandbox-aware
  remediation, instead of letting writes fail later with a bare `EPERM`.
- **`tbd setup --surfaces` selector**: setup replaces its per-agent flags with a single
  `--surfaces=<list>` selector backed by a surface registry.
  Choose any comma-separated mix of `portable`, `agents-md`, `claude`, `codex`, or `all`
  (the default) to control exactly which integration surfaces are installed.
  **Note:** this removes the old `--all`, `--claude`, `--codex`, `--skip-claude`, and
  `--skip-codex` flags; scripts using them should move to `--surfaces`.

### Fixes

- **Structured three-way merge for issue sync (#155)**: sync now merges issues
  field-by-field from their git refs instead of doing a line-level text merge.
  This closes several ways a concurrent or push-retry sync could previously mangle data:
  - `child_order_hints` are union-merged (and null-safe), so concurrent edits no longer
    drop child-ordering wiring.
  - A missing issue is distinguished from a corrupt one during a ref merge.
  - Push-retry integrates the remote into the sync branch and re-runs the structured
    merge before retrying, rather than retrying against stale state.
  - A post-merge guard fails the sync loudly if any issue is left unparseable, instead
    of committing corrupt data.
- **Sync exits non-zero when a push failure isn’t parked in the outbox (#158)**: a
  failed push that could not be saved to the outbox for later retry now surfaces as a
  non-zero exit, so automation sees the failure instead of treating it as success.
- **Non-destructive rescue tolerates a dirty sync worktree (#158)**: recovery from
  unrelated histories no longer refuses when the sync worktree has uncommitted changes —
  the rescue captures that work on a backup branch — and unrelated-history divergence no
  longer suggests the unhelpful `tbd sync`.
- **Worktree auto-heal is surfaced at the point of use (#135)**: when a read or create
  re-creates a missing sync worktree, tbd now tells you it healed instead of repairing
  invisibly.
- **`tbd sync --status` shows the incoming remote commits**: the remote-commit lookup
  used an invalid `git log --limit` flag that threw and was swallowed, so the list was
  always empty; it now reports the commits the remote is ahead by.
- **Generated session script pins the published version**: the session script now pins
  `get-tbd@<published version>` instead of a dev/dirty `git describe` build string that
  isn’t installable from npm and churned generated files on every local build.

### Guidelines and content

These ship inside the package and are read by agents via `tbd guidelines …` and
`tbd setup`:

- **New `general-eng-agent-principles` guideline**: consolidates the core engineering
  standards — objectivity, communication, and the engineering process (understanding,
  verification, end-to-end ownership, scope discipline) — into one document, replacing
  the older `general-eng-assistant-rules`.
- **`cli-agent-skill-patterns` — attention-routing framing and an L0–L3 ladder**:
  expanded guidance on how coding agents discover and monitor CLI-backed skills, plus
  research on agent-skill and CLI packaging practices.
- **TypeScript guideline refresh**: clarifications across `typescript-rules`,
  `typescript-cli-tool-rules`, `typescript-code-coverage`, and the YAML/sorting rules.
- **`repren` agent skill** is now installed alongside the other surfaces for
  large-scale, multi-file renames.

### Security

Lockfile unchanged since v0.2.2; the resolved dependency tree is byte-identical, so no
new advisories. The only manifest change is a dev-tooling formatter swap (`flowmark` →
first-party `flowmark-rs`, pinned with a documented cool-off exception); it is not a
runtime dependency of the published package.

## 0.2.2

A drop-in patch on top of v0.2.1. **No on-disk format change** (`f04` stays `f04`), so
any machine already on v0.2.0 or later can upgrade without a migration.

### Fixes

- **`tbd setup --auto --dry-run` is now genuinely read-only.** The legacy-cleanup pass
  ran before any dry-run gating, so inspecting a setup with `--dry-run` could rewrite
  `.claude/settings.json` and delete legacy tbd scripts and hooks from disk — including
  hooks you had just installed.
  Dry runs now compute and report what *would* change ("Would clean up legacy …")
  without touching any files.
  Covered by two new regression tests.

### Guidelines and content

These ship inside the package and are read by agents via `tbd guidelines …`:

- **`supply-chain-hardening` — new “Safe-override patterns” section**: how to pull a
  fresh package version without weakening the global 14-day cool-off
  (verify-then-install flow with per-ecosystem verify commands, tarball-URL and git-ref
  installs that bypass npm version resolution, exact pins for uv/cargo/go), plus the
  dogfood footgun where an age gate silently resolves `@latest` to a *stale* version.
- **`cli-agent-skill-patterns` — L0–L3 integration ladder and project-vs-global scope**:
  the binary Tier-1/Tier-2 model is replaced by an L0–L3 ladder (pure prompt skill →
  pinned-delegation skill → self-installing skill → full platform), and a new §6.6.2
  codifies project-local vs user-global install mechanics (explicit
  `--project`/`--global`, `$HOME` refusal in project mode, pre-write target printing,
  cross-scope shadowing).

### Documentation

- Applied the common documentation guidelines to the docs shipped in this release (write
  “and” rather than "&"/"+" in prose, headings, and cross-references).

## 0.2.1

A drop-in patch on top of v0.2.0. **No on-disk format change** (`f04` stays `f04`), so
any machine already on v0.2.0 can upgrade without a migration.
The headline is hardened recovery when a repo’s issue-sync branch and local history have
drifted into unrelated git histories.

### Features

- **Unrelated-history detection and non-destructive rescue**: tbd now recognizes when
  the local issue store and the remote `tbd-sync` branch share no common git history — a
  corruption/misconfiguration that previously surfaced as a confusing mid-sync failure.
  - `tbd doctor` reports it as a hard `✗` finding (and exits non-zero, matching v0.2.0’s
    doctor contract).
  - `tbd doctor --fix` performs a **non-destructive rescue** that preserves your issue
    files instead of discarding either history.
  - `tbd sync` detects the condition up front rather than failing partway through, and a
    missing or unhealthy remote sync branch is re-established as a fresh orphan rather
    than left broken.
- **`tbd prime`** now reminds you that `tbd setup --auto` refreshes the installed skills
  and settings, so a long-running agent session knows how to pick up updates.

### Fixes

- **Release notes come from the CHANGELOG**: the GitHub Release body is now populated
  from this `## X.Y.Z` section instead of the old bare `Release vX.Y.Z` fallback, and
  tag publication is gated on a green main CI run for the exact tagged commit.
- **Skill no longer restates a drifting type list**: the bundled tbd skill stopped
  hard-coding the issue-type enum (which had drifted from the CLI once `chore` was
  added) and now points agents to `tbd create --help` for the authoritative list.
- **Generated skills are protected from downgrade**: every generated `SKILL.md` now
  carries a `format=fNN` stamp, and `tbd setup` refuses to overwrite a skill written by
  a newer tbd (telling you to upgrade) instead of silently rolling it back.

### Guidelines & skills

These ship inside the package and are read by agents via `tbd guidelines …` and
`tbd skill`:

- **`cli-agent-skill-patterns` guideline — new guidance for authoring CLI-backed skills
  and handling their upgrades:**
  - **Route, don’t restate**: when a skill is backed by a CLI, that CLI’s own `--help`
    and informational subcommands are the authoritative reference layer.
    The skill should point to them rather than copying flags, types, and output formats
    that then drift (the type-enum drift fixed above is exactly this failure mode).
  - **When to bump the `fNN` format**: reserve a format bump for changes big enough to
    need an explicit migration.
    Routine content updates ship by regenerating the surface on the next `setup` — no
    bump, no migration — so the format code does not churn on every edit.
  - **Upgrades are opt-in, never silent**: a tool only rewrites a user’s committed files
    on an explicit `setup`; a `SessionStart` hook should run the read-only `prime`, not
    `setup`.
  - **Overwritten surfaces must be guarded**: stamp and guard each generated surface (or
    run the format check before writing anything) so an older tool cannot
    partial-downgrade a newer committed skill.
- The bundled **skill baseline** stops over-documenting CLI-backed commands and leans on
  `--help` for the authoritative flag/type reference.

### Security

- Lockfile is byte-identical to v0.2.0 — no manifest changes and no new advisories
  (`pnpm audit --prod` clean, `pnpm check:package-age` reports 0 violations).

**Full commit history**:
[https://github.com/jlevy/tbd/compare/v0.2.0 … v0.2.1](https://github.com/jlevy/tbd/compare/v0.2.0...v0.2.1)

## 0.2.0

**This release ships a new on-disk format (`f03` → `f04`). Every machine that touches a
tbd-managed repository must upgrade to v0.2.0; older clients fail closed.** See
“Upgrading” below if you have a multi-worktree setup or are coming from `v0.1.30`.

### Features

- **Shared common-dir sync worktree**: the local issue-sync worktree moves out of the
  per-checkout `.tbd/data-sync-worktree/` and into the shared
  `$GIT_COMMON_DIR/tbd/data-sync-worktree/`. Multi-worktree repos no longer hit the
  “`tbd-sync` is already used by worktree” failure when a sibling checkout runs `tbd`.
  All linked worktrees in a repo share one issue store, one branch checkout, and one
  lock.
- **`$GIT_COMMON_DIR/tbd/layout.yml`** stamps the on-disk layout with the same
  `tbd_format` ID as the per-checkout config, so the repo-scoped state and the
  branch-visible config are versioned independently and validated against each other on
  every read.
- **Migration affordance**: `tbd doctor --fix` now performs the `f03 → f04` migration
  directly (legacy worktree migration, shared `layout.yml` write, and config bump under
  the shared `data-sync.lock`). Before, you had to know to run `tbd sync` for the
  migration to happen.
- **`tbd doctor` exits non-zero on hard `✗` findings** — future-format markers, invalid
  config, corrupted issue files.
  Warning-level (`⚠`) findings still exit 0. CI and scripts can now gate on doctor’s
  exit code.
- **`tbd status` no longer says “unhealthy”** for the common “shared worktree not
  initialized yet” case.
  It now says `(not initialized) — Run: tbd sync (or tbd doctor --fix) to initialize`.

### Upgrade contract

- Every machine that touches a tbd-managed repo must upgrade.
  Older clients running against an `f04` repo will fail closed on most commands with an
  explicit upgrade message and exit non-zero.

- **Known pre-existing quirk on `v0.1.30`**: `tbd doctor` against an `f04` repo on
  `v0.1.30` reports `✗ Config file - Invalid config file` with exit 0 instead of the
  clear “newer tbd version” upgrade message.
  If you see that, run `npm install -g get-tbd@latest` — do not try `tbd doctor --fix`
  on the older client.
  `v0.2.0`’s `doctor` is fixed to surface the upgrade message clearly.

- **Multi-worktree config bump notice**: when the first command in a checkout migrates
  that checkout’s `.tbd/config.yml` from `f03` to `f04`, tbd now prints to stderr:

  ```
  • tbd_format f03 → f04: .tbd/config.yml updated in this checkout.
    Commit on this branch or merge main to publish the format upgrade.
  ```

  Expect to see this once per checkout that lacks the bump commit; commit (or merge
  `main` into) the per-branch config diff to publish.

### Fixes

- **Internal `tbd-sync` commits are signing-agnostic**: machine-generated commits to the
  data-sync branch now pass `-c commit.gpgsign=false`, so users with
  `commit.gpgsign=true` and no usable signing key no longer see “worktree corrupted” /
  “gpg failed to sign” stalls during migration or sync.
- **Shared-lock boundary covers init and repair**: every code path that initializes or
  repairs the shared layout (`tbd sync`, `tbd doctor --fix`, `tbd init`, the
  data-context read path) now runs inside `withSharedDataSyncLock`, preventing
  concurrent agents from sibling worktrees from racing migration.
- **Read-only commands skip the shared lock when state is steady** — locking only kicks
  in when first-use initialization, migration, or repair is actually required.
- **`tbd doctor --fix` repairs a layout/config `tbd_format` mismatch** by rewriting
  `layout.yml` from the trusted config.
  A future-format layout (e.g. a marker from a newer tbd) is surfaced as
  `requires newer tbd` and is never silently downgraded.

## 0.1.30

### Patch Changes

- 6d706cd: Modernize multi-agent skills and hooks setup.

  `tbd setup --auto` now installs the portable Agent Skill at
  `.agents/skills/tbd/SKILL.md` (the cross-agent standard path read by Codex, Gemini
  CLI, Cursor, Copilot, Amp, OpenCode, and others) and mirrors the identical payload to
  `.claude/skills/tbd/SKILL.md` for Claude Code.
  - **Codex hooks**: setup writes `.codex/hooks.json` plus Codex-native scripts
    (SessionStart/PreCompact run `tbd prime`, PostToolUse reminds about `tbd sync` after
    `git push`, optional SessionStart ensures `gh`). Codex hooks reference only
    `.codex/`, never `.claude/`.
  - **Compact AGENTS.md block**: the managed `AGENTS.md` section is now a short
    bootstrap that points to `tbd prime`/`tbd skill`/`tbd shortcut --list`/
    `tbd guidelines --list` instead of embedding the full skill.
  - **Format-version guard**: generated artifacts carry an integration-format stamp.
    Setup self-upgrades older blocks in place, but refuses to overwrite an artifact
    written by a newer tbd, telling you to run `npm install -g get-tbd@latest`. This
    makes version pinning safe across a team.
  - **Pinned runner fallback**: generated session scripts are local-first, then a
    version-pinned `npx get-tbd@<version>` fallback (never unpinned).
  - **Agent-targeting flags**: `--all`, `--claude`, `--codex`, `--skip-claude`,
    `--skip-codex`.
  - **Distribution copy**: a committed `skills/tbd/SKILL.md` for skills.sh-style
    installers (`npx skills add`) and GitHub browsing.
  - `tbd doctor` and `tbd status` now report all of these surfaces.

  Backwards compatible: existing Claude Code installs keep working and are upgraded in
  place on the next `tbd setup --auto`.

## 0.1.29

### Patch Changes

- Documentation release: agent-skill guidelines refresh and supply-chain hardening.
  - Rewrote the `cli-agent-skill-patterns` guideline into a broad, multi-agent **Agent
    Skills & CLI Integration Patterns** guide: a non-dogmatic simple baseline (one
    `SKILL.md`), a 15-agent integration matrix (Claude Code, Codex, Cursor, Copilot,
    Gemini CLI, Windsurf, Cline, Aider, opencode, Amp, Jules, Goose, Zed, Factory, pi),
    the `AGENTS.md` / Agent Skills open-standard model, CLI-as-skill vs.
    MCP guidance, a CLI install-vs-zero-install section, and security/testing/versioning
    sections.
  - Added a new **`supply-chain-hardening`** guideline
    (`tbd guidelines supply-chain-hardening`): the cross-ecosystem 14-day cool-off plus
    Node/pnpm/Bun enforcement (lifecycle-script allowlists, lockfile discipline,
    `ncu --cooldown`, a CI audit gate, a pre-push age guard, and the exception process),
    strongly recommended for every repo and referencing
    github.com/jlevy/supply-chain-hardening for the full playbooks.
    De-duplicated the Supply-Chain Mitigation content out of the bun and pnpm monorepo
    guides into this standalone guideline.
  - Fixed generated skill/agent files: `tbd setup` no longer emits a stray mid-document
    YAML frontmatter block in `.claude/skills/<tool>/SKILL.md` or the `AGENTS.md`
    integration section, so the generated files are stable and idempotent under Prettier
    and flowmark.

## 0.1.28

### Patch Changes

- 2322a95: Clarify dependency direction in `tbd show` output with `Blocks:` and
  `Blocked by:` comments.
- Fix `tbd doctor` “Temp files” check: display the actual scanned path
  (`.tbd/data-sync/issues`) instead of the stale `.tbd/issues`, and widen the filter to
  catch `atomically`’s `*.md.tmp-NNNN` leftover intermediates.
- Refresh Bun/pnpm monorepo and TypeScript guidelines to May 2026 versions (Bun 1.3.x,
  TS 6.0/7.0 Beta, pnpm 11, ESLint 10, Vitest 4.1, Zod 4, Commander 15, Biome 2.4) and
  add a normative Supply-Chain Mitigation section to both monorepo guides codifying a
  14-day package-age rule with lockfile discipline, provenance checks, and exception
  process.
- Bump `yaml` to `~2.8.3` (resolves to 2.8.4) to patch GHSA-48c2-rrv3-qjmp (moderate
  stack-overflow DoS on deeply nested YAML); range narrowed from `^2.8.2` to `~2.8.3` so
  the resolved minor satisfies the project’s 14-day package-age rule.

## 0.1.27

### Patch Changes

- e166f14: Reject invalid issue titles before writing issue files, skip parse-invalid
  issue files without crashing, and report invalid issue files in `tbd doctor`.

## 0.1.26

### Patch Changes

- c9da6aa: Auto-resolve ids.yml merge conflicts during sync and doctor --fix, add
  merge=union gitattributes inside worktree to prevent future conflicts, fix CI badge
  scope, remove dead code, and update dependencies.

## 0.1.25

### Patch Changes

- Fix short-ID mapping loss during concurrent creation, improve doctor check ordering,
  resolve Windows CI test flakiness, and add research docs for orchestration and
  knowledge architecture.

## 0.1.24

### Patch Changes

- 71d6033: Bug fixes for concurrent create race conditions, migration safety, doctor
  history scanning, lockfile defaults, and sync status reporting.

## 0.1.23

### Patch Changes

- e746cce: Fix sync flag handling, remove unused CLI flags, and fix Windows CI timeout

## 0.1.22

### Patch Changes

- b98e317: Fix ID mapping loss during git merges with automatic reconciliation and merge
  protection

## 0.1.21

### Patch Changes

- 7948df2: Fix outbox sync bulk save noise, add deterministic YAML field ordering, and
  fix list sort order stability.

## 0.1.20

### Patch Changes

- 703f84f: Fix workspace gitignore handling, add parent context display for child beads,
  and new documentation guidelines

## 0.1.19

### Patch Changes

- 4586df7: Bug fixes: prevent .tbd root detection from finding spurious .tbd/ in
  subdirectories, make baseDir required in path functions to prevent subdirectory bugs,
  show relative paths in uninstall preview output, and fix tryscript test expectations
  for config output format.

## 0.1.18

### Patch Changes

- 0feb918: Bug fixes and stability improvements: YAML duplicate key handling after merge
  conflicts, sync debug log branch fix, beads import priority mapping, EPIPE pager
  handling, improved error cause chains, workspace save/import progress logging, and
  test stability fixes.

## 0.1.17

### Patch Changes

- 3f1a09c: Add interactive markdown rendering with pagination for doc commands
  (guidelines, shortcuts, templates) and improve YAML frontmatter styling with syntax
  highlighting.

## 0.1.16

### Patch Changes

- 78d4671: Bug fixes and improvements including doctor remote count fix, init git root
  resolution, JSON mode options suppression, streamlined sync outbox workflow, and
  updated default no-args behavior.

## 0.1.15

### Patch Changes

- 6062050: Documentation consolidation: new shortcuts directory, comprehensive
  TypeScript monorepo and CLI guidelines, and updated README with new shortcuts and
  guidelines.

## 0.1.14

### Patch Changes

- 65b691f: Two-tier prefix validation with --force override, YAML handling improvements
  with Zod validation, and various bug fixes.

## 0.1.13

### Patch Changes

- Workspace sync feature, child bead ordering hints, unified review-code shortcut, and
  various improvements.

## 0.1.12

### Patch Changes

- 1509909: Bug fixes for sync reliability, stats output redesign, and documentation
  improvements.

## 0.1.11

### Patch Changes

- Terminal design system, shortcut improvements, and bug fixes

## 0.1.10

### Patch Changes

- c2cff07: Fix detached HEAD worktree handling for users upgrading from older tbd
  versions. Auto-repairs worktrees that were created before the detached HEAD
  improvement, ensuring sync operations preserve the working directory correctly.

## 0.1.9

### Patch Changes

- 2809883: Worktree robustness improvements, setup bug fixes, and documentation updates.
  Key changes include automatic worktree detection and repair, graceful handling of
  already-migrated data, bypassing parent repo hooks in worktree commits, improved
  .gitignore management on upgrade, and simplified agent integration documentation.

## 0.1.8

### Patch Changes

- Rename npm package from tbd-git to get-tbd, add --specs flag for tbd list, fix
  project-local hook installation, and improve setup git root resolution

## 0.1.7

### Patch Changes

- Inherit spec_path from parent beads, automatic gh CLI setup via SessionStart hook, and
  various bug fixes

## 0.1.6

### Patch Changes

- afc01dd: Agent orientation system, DocCache with shortcuts, and documentation
  improvements.
- cc830b5: Spec linking feature with `--spec` options for create/list commands,
  configurable doc cache with auto-sync, and various bug fixes.

## 0.1.5

### Patch Changes

- afc01dd: Agent orientation system, DocCache with shortcuts, and documentation
  improvements.

## 0.1.4

### Patch Changes

- Fix subdirectory support, enforce atomic writes for data integrity, and add
  relationship types documentation.

## 0.1.3

### Patch Changes

- Fix build to ensure clean version numbers by syncing documentation files before
  release.

## 0.1.2

### Patch Changes

- Bug fixes, CLI improvements, and documentation updates including redesigned
  status/stats/doctor commands, improved error handling with proper exit codes, and test
  infrastructure improvements.

## 0.1.1

### Patch Changes

- Fix flaky performance test and clarify publishing documentation
