---
title: External Tracker Integrations
description: A provider-generic integration layer for syncing beads with external trackers, with Linear as the first provider and GitHub issues and PRs next
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: External Tracker Integrations (Linear first, GitHub next)

**Date:** 2026-08-10 (last updated 2026-08-13)

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Phases 1 and 2 are implemented in PR
[#206](https://github.com/jlevy/tbd/pull/206), now merged with the published v0.5.0
`main`. The built CLI and a disposable live Linear issue have passed outbound creation,
inbound and outbound comments, forced conflict recovery, archived-item detection, and a
two-clone alternating-sync soak.
The post-v0.5 review added fail-closed duplicate-link handling, exact conflict
archive/replay, strict read-only pulls, explicit inbound selection, and cross-repository
link claims. The pilot keeps `sync_on_tbd_sync: false` until PR review and hosted CI are
final green; this is an operational rollout switch, not an unresolved design dependency.
Phase 3 (GitHub issue sync plus read-only PR associations) and Phase 4 (external links
in `tbd web`) are designed and tracked here, not built.

## Overview

tbd holds the durable truth about work in git.
Some of that work also needs to be visible and actionable in an external tracker: for
humans who do not clone the repo, for a cross-branch overview that does not depend on
which branch is checked out, and for linking work to the PRs that implement it.

This spec defines a **provider-generic integration layer** with **Linear as the first
provider** and **GitHub (issues and pull requests) as the second**. Both are designed
together so the seams are right, and sequenced so Linear ships and proves the model
before GitHub is written.

The design deliberately starts with a **one-way mirror** and adds bidirectional sync
only after that works, because the mirror delivers the highest-value use case (a clean
cross-branch overview of epics) with none of the distributed-systems risk.

**Design inputs:**

- [research-2026-08-09-linear-task-surfaces.md](../../research/current/research-2026-08-09-linear-task-surfaces.md)
  — the API facts here were verified against a live workspace, and several published
  Linear facts turned out to be wrong.
  §1 (verified API facts), §5.6a (epic overview), §7b (sync design analysis), and §7c
  (storage comparison) are the load-bearing sections.
- **PR [#197](https://github.com/jlevy/tbd/pull/197)** and its
  `plan-2026-07-20-linear-bead-sync-pilot.md` — substantial prior design, much of it
  adopted here. See [Relationship to PR #197](#relationship-to-pr-197).
- [plan-2026-08-10-tbd-web-live-bead-view.md](../done/plan-2026-08-10-tbd-web-live-bead-view.md)
  — the local web view.
  It is the higher priority and is **not** part of this spec.
- PR [#205](https://github.com/jlevy/tbd/pull/205) — `tbd changes` / `tbd watch`, the
  provider-neutral primitive this consumes.

## Goals

- **Setup is checkable and self-explaining.** `tbd integration status` reports whether
  each provider is configured, credentialed, and reachable, and says exactly what to do
  when it is not. `tbd doctor` surfaces the same findings.
- **Credentials load from `.env`** as well as the environment, so agents and humans
  configure a repo once.
  tbd has no `.env` support today.
- **A bead can be linked to exactly one external item**, and the link survives sync and
  merge.
- **Full bead content is visible in Linear**, including fields Linear has no schema for:
  spec links, repo and PR links, dependency and child counts, and the tbd id.
- **A clean overview of major work**: epics and explicitly linked beads mirror into
  Linear, giving a cross-branch view no branch-local file can offer.
- **Sync is uneventful in the ordinary case, and never silently lossy in the rare one.**
  Genuine conflicts archive the loser to the local attic *and* post a comment on the
  external item so a human or agent can resolve it later.
- **Provider-generic from day one.** One command group, one config shape, one adapter
  interface. Adding GitHub changes configuration and one adapter, not workflow.
- **Customizable, but only a little.** One structured
  [linking policy](#the-linking-policy) per integration — when beads go out, when issues
  come in, how linked pairs reconcile — with one named default.
  Flexibility lives in that one object and in selector overrides on the commands, not in
  a proliferation of flags.
- **Nothing changes for repositories that do not enable an integration.**

## Non-Goals

- **No daemon and no webhooks.** Linear webhooks need a public HTTPS endpoint answering
  within 5 seconds, which a CLI cannot offer.
  Polling is also the mandatory reconciliation path regardless, because Linear retries a
  failed webhook only 3 times before auto-disabling it.
- **No Linear Agents / `AgentSession` integration.** It needs a hosted OAuth `actor=app`
  backend. It remains the eventual target for delegation and is out of scope here.
- **No mirroring of the whole bead store.** Only policy-selected and explicitly linked
  beads participate — typically ~10% of open work.
  The value is the filter.
- **No synchronization of comment edits or deletions.** Comments *do* sync — as
  append-only sequences, which is what makes them easy (see
  [Comments](#comments-append-only-sequences-not-merged-fields)) — but an edit or
  deletion on either side is out of scope: the stored sequence keeps the original.
  Notes (`notes:` on a bead) stay local-only.
- **No multi-repo to one tracker support.** Two repos linking the same external item
  would double-write. A `tbd://bead/…` attachment is the durable claim; link and inbound
  creation probe it and refuse a second writer unless `--force` is explicit.
  The probe is a guard, not a distributed transaction: simultaneous first links can
  still race.
- **No generated `TODO.md`** in this spec.
  Deferred deliberately: the format is unsettled, and a second generated to-do surface
  risks agents disagreeing about which list is authoritative.

## Background

**Constraints that shaped the design** (verified 2026-08-10):

- **Git subprocesses inherit the full environment**: `buildGitEnv()`
  (`packages/tbd/src/lib/git-env.ts`) spreads `...process.env` into every spawned git
  process, and git in turn runs user hooks.
  This constrains the credential design: a secret loaded into `process.env` would leak
  into every git hook.
  See
  [Component 1](#1-credentials-and-env-srclibenv-filets-srcintegrationscorecredentialsts).
- Issue parsing uses Zod strip mode, so **unknown top-level frontmatter fields are
  discarded on write** by an older CLI. Any new top-level synced field needs a format
  gate — which is why links live in the `extensions` namespace instead (see
  [Component 3](#3-link-storage-the-extensions-namespace-integrationscorelink-storets)).
- `mergeIssues(base, local, remote)` (`packages/tbd/src/file/git.ts`) is already a real
  three-way merge against git’s merge base.
  LWW applies only as the tie-break when both sides changed the same field, with the
  loser preserved in `attic/`.
- CLI commands follow the `BaseCommand` pattern
  (`packages/tbd/src/cli/lib/base-command.ts`): a handler class with `run()`, `this.ctx`
  for global flags, `this.output.data(json, textFn)` for dual output, `CLIError` +
  shared exit codes from `cli/lib/exit-codes.ts`.
- This repo has **1,312 beads, 217 active, 21 active epics, 14 of those carrying a
  `spec_path`** — the default mirror set is a few dozen items, roughly 10% of active
  work.

**Gaps that existed when this design began, closed by Phase 1** (PR #206):

- No external tracker support, no `.env` loading, no integration config.
- `extensions` merged as **whole-object LWW**: two writers touching different namespaces
  silently dropped one side (`tbd-le2l`). Now a per-namespace three-way merge in which
  **absence is a value**, so a deleted namespace (an unlink) is not resurrected by a
  concurrent edit.
- No cycle or depth validation on `parent_id`; a cycle made every ancestor walk
  non-terminating. Now rejected on the write path, with a `doctor` check for existing
  data.

**Key Linear API facts** (verified live; several contradict Linear’s own docs):

| Fact | Value |
| --- | --- |
| Requests/hour on an API key | **2,500**, not the documented 5,000 |
| Rate-limit error | HTTP **400** with `code: RATELIMITED`, not 429 |
| Max page size | **250** (undocumented); default 50 |
| `WorkflowState.type` | A **`String!` scalar**, not an enum; a default team exposes `duplicate` beyond the commonly cited six values |
| `issueCreate` with a client `id` | **Not idempotent.** Duplicate id returns `INPUT_ERROR` / 400, `"Entity Issue ... already exists"` |
| `attachmentCreate` | **A true upsert keyed on `url`.** Same id returned, `title`/`subtitle`/`metadata` replaced |
| `Attachment.metadata` | Accepts **nested objects and arrays**, despite being documented as string and number values |
| Custom fields | **None exist.** Label groups are single-select, 250 per group, and are the only enum-like column |
| Sub-issue nesting | **Arbitrary depth** (4 levels verified) |
| Comments | `commentCreate`, plus `commentResolve` / `commentUnresolve` for a handled/unhandled lifecycle |

## Dependencies

Decision: **zero new runtime dependencies.** Reviewed against SUPPLY-CHAIN-SECURITY.md
and the existing dependency set.

| Need | Choice | Rationale |
| --- | --- | --- |
| `.env` parsing | **Node built-in `util.parseEnv`** | Node’s own dotenv-compatible parser: handles quotes, comments, `export` prefixes, and multiline values. It is the “library” answer without the dependency. Available since Node 20.12 / 21.7; see engines note below |
| HTTP | **Native `fetch`** (Node ≥ 18) | Already the platform baseline; no undici/axios needed |
| GraphQL | **Template strings over `fetch`** | The pilot needs ~6 queries and ~5 mutations. `@linear/sdk` brings typed models and pagination helpers but adds a dependency and its own release cadence for a surface this small. Revisit only if the query surface grows substantially |
| Response/state validation | **`zod`** (already a dependency) | Same tool used for every other schema in the codebase |
| Bridge-state files | **`yaml`** (already a dependency) | Same serializer as config and mappings |
| GitHub REST | **Native `fetch`**, token via `gh auth token` fallback | Issues + PR linking is a handful of endpoints; Octokit is not warranted |
| Secret masking, ref parsing, managed block | **Internal** (~30 lines each) | Trivial, and each has project-specific behavior worth owning |

**Engines note:** `util.parseEnv` requires Node ≥ 20.12. Current engines say `>=20`.
Bump `engines.node` to `>=20.12` in the same PR (a patch-level floor raise within the
supported major; Node 20.12 shipped 2024-03). The alternative, shipping a fallback
parser for 20.0–20.11, doubles the test surface to support Node versions nobody should
be running.

What is deliberately **not** internal: quoting/escaping rules of dotenv files (use
`util.parseEnv`), markdown rendering (not needed), and OAuth flows (out of scope; API
keys only).

### Packaging: built into `get-tbd`, not a second package

Decided with Phase 1 measured, not estimated (2026-08-10):

| Evidence | Value |
| --- | --- |
| Integration source, Phase 1 (core + linear + env/hierarchy/command) | **2,942 lines**, ~8% of the package’s 37k |
| Integration tests (incl. the mock server) | 2,307 lines |
| Runtime dependency delta vs `main` | **zero** — the two lists are identical |
| tbd’s entire built output | 8.7 MB |
| `@linear/sdk` alone, unpacked | **29.3 MB** — at major version **89**, i.e. a release cadence we would be pinned to |
| `@octokit/rest` | 4 direct deps, ~a dozen transitive packages, for what is a handful of `fetch` calls |

So both criteria for building in are met, and the SDK route fails both: the code is
small, and the “library answers” each cost more than the whole feature.
Per SUPPLY-CHAIN-SECURITY.md, every adopted package is also a recurring audit and
cool-off obligation; zero remains zero through Phase 2 (`yaml` and `zod` are already
dependencies) and, by design, through Phase 3 (GitHub is REST over `fetch`; the `gh` CLI
is an *optional, detected* fallback for tokens, never an npm dependency).

The reasons beyond size, in order of weight:

1. **The trust boundary stays in this repo.** Credentials are handled only by code whose
   invariants (never `process.env`, never logged, allow-listed persistence) are enforced
   by this repo’s own tests.
   A separate package with credential access would widen that boundary and split the
   security review across release trains.
2. **The integration touches core seams** — the `extensions` merge, bridge records on
   the sync branch, config schema, doctor.
   Built in, those stay internal modules; split out, every one becomes public API frozen
   at the first plugin release.
   The version-skew matrix (plugin × core) is exactly the class of failure the
   config-stripping incidents previewed.
3. **One install story.** `npm install -g get-tbd` and `tbd integration status`
   self-explains. A second package adds discovery, install docs, and a new failure mode
   (mismatched versions) to every setup conversation.
4. **Precedent.** The same call was recorded for `tbd web` in PR #207 (“ships in core;
   no separate package”).

**The decision rule for future providers**, so this stays a policy rather than a
one-off: a provider ships built in iff it adds **zero runtime dependencies** and its
verified surface stays small (roughly ≤1,500 source lines); otherwise it ships as a
separate package behind the `TrackerAdapter` seam — and only at that point does the
adapter interface become public API, designed deliberately rather than frozen by
accident. Jira is the likely first case (heavy SDK, OAuth); Linear and GitHub are not.

## Design

### Approach

Three layers, each independently useful:

1. **Integration framework** — config, credentials, `.env` loading, status and doctor
   checks, and the `TrackerAdapter` seam.
   Provider-agnostic. *(Shipped in Phase 1.)*
2. **Mirror (one-way, tbd to tracker)** — the selection set is projected outward.
   Nothing is imported.
   This needs none of the concurrency machinery below and is safe to run from any agent.
   *(Shipped in Phase 1, validated live including a team move that renumbered every
   issue.)*
3. **Sync (bidirectional, on linked pairs)** — three-way merge against a recorded base,
   with conflict comments.
   *(Phase 2, designed below.)*

**The organizing concept is a per-integration [linking policy](#the-linking-policy).**
Everything an integration does is one of four things, and the policy has a clause for
each:

The clause names state their direction (a review round found `mirror`/`import`/`sync`
too vague about which way data moves, and `sync` should be reserved for the full
synchronization):

| Question | Policy clause | Verb it defaults |
| --- | --- | --- |
| When should a bead create a tracker issue? | `outbound` — a selector over beads | `tbd integration sync --push` |
| When should a tracker issue create a bead? | `inbound` — a selector over external items, plus a mode | `tbd integration sync --pull` |
| How do a **linked** pair’s fields and comments flow when one or both sides changed? | `field_sync` — per-field flow rules, comment mode, and a conflict tie-break | `tbd integration sync` |
| What about everything else? | Nothing happens to it — but it is **visible**: `status` reports unlinked-but-matching beads, importable items, drift, and conflicts | `tbd integration status` |

Two rules make this composable rather than policy-bound, both validated by the Phase 1
staged rollout:

- **The policy is only a default.
  Explicit selectors always override it.** `sync --push --bead X` projects X whether or
  not the outbound policy matches it; `sync --pull --external FIN-123` creates a bead
  regardless of the inbound clause; `link` and `unlink` are always manual.
  A staged rollout (3 beads, then 13, then 82) needs no config edits.
- **Linking and syncing are separate decisions.** The policy governs when *links come
  into existence*. Once a pair is linked — by policy, by hand, or by explicit inbound
  selection — `sync` reconciles it until it is unlinked.
  Membership in the outbound selector is not re-checked at sync time, so un-matching a
  bead (say, its spec archives) stops new attention but never strands a live link.

`sync` is the one verb that performs the **full synchronization**: replay pending
intents, reconcile every linked pair per `field_sync`, then handle policy-matching
unlinked work on both sides (create outbound, create or report inbound).
`--push` selectors and `--pull --external` are the targeted, manual forms of its two
halves. `status` is the read-only preview of exactly the same computation.

### Command vocabulary: one set of words across every surface

`tbd sync` already established the vocabulary for moving data: **bare is both
directions, `--push` is outbound only, `--pull` is inbound only, `--status` reports
without writing**, and `--docs` / `--issues` select surfaces.
External trackers reuse that vocabulary exactly rather than inventing a parallel one:

| Surface | Both directions | Outbound only | Inbound only | Report |
| --- | --- | --- | --- | --- |
| Issues (git) | `tbd sync --issues` | `--issues --push` | `--issues --pull` | `tbd sync --status` |
| Docs | `tbd sync --docs` | — (no remote) | — | `tbd sync --docs --status` |
| Trackers | `tbd integration sync` | `tbd integration sync --push [selectors]` | `tbd integration sync --pull [--external <ref...>]` | `tbd integration status` |
| Everything | `tbd sync` | `tbd sync --push` | `tbd sync --pull` | `tbd sync --status` |

This replaces the earlier `mirror` and `import` verbs, which named a mechanism rather
than a direction and left `sync` ambiguous about how much it covered.
A reader who knows `tbd sync --pull` now knows what `tbd integration sync --pull` does,
and `sync` means full synchronization everywhere it appears.

`--push` on a tracker remains the *projection* (selected beads out, attachments and the
managed block refreshed, nothing read back for merging) because that is what a one-way
outbound run should do.
`tbd sync --push` invokes that same projection while the data-sync lock is held, then
commits and pushes its bead/link writes with the issue surface.
It never substitutes a full bidirectional tracker reconciliation merely because tracker
sync is folded into the top-level command.
`--pull` performs **no external write, including journal replay**. Every inbound-created
bead journals its attachment claim before the provider is touched.
A full sync deletes that intent only after the idempotent upsert succeeds; a pull-only
run leaves it for the next bare/full sync.
The bare form runs the complete reconciling engine.

### Sync surfaces: one default, independent failures

**Plain `tbd sync` covers every surface** — docs, issues, and enabled trackers — so an
agent closing a session runs one command and the whole repository is current.
Selectors narrow it: `--docs`, `--issues`, `--integrations`.

**Surfaces run independently and failures roll up.** A missing or expired tracker
credential must not stop docs or issues from syncing, and vice versa: each surface is
attempted, each failure is collected with its surface name, all of them are reported
together at the end, and the exit code is non-zero if any failed.
Nothing a working surface would have persisted is lost because another surface broke.
Contained per-item provider failures count as a failed tracker surface; they are not
hidden merely because the provider returned a report instead of throwing.
Configuration read/validation errors likewise fail closed and retain their diagnostic.

Ordering is deliberate rather than arbitrary:

1. **Docs** first — local and fast, so they land even if the network is unusable.
2. **Issues** over git, with the **tracker run nested between the pull/merge and the
   push**. That position is load-bearing: after the merge the engine reconciles bead
   state that already includes other machines’ work, and before the push its bead and
   bridge writes ride the same push out.
3. **Trackers standalone**, only if step 2 did not reach them (issues not selected, or
   the git phase failed first).
   Its writes are still committed to the sync branch, so the next successful push
   carries them — a git problem delays tracker work, never loses it.

`sync_on_tbd_sync` therefore defaults to **true**: enabling an integration is already
the explicit opt-in, and a second flag only creates a state where a configured tracker
silently drifts. Setting it false keeps the integration configured but excluded from
`tbd sync`, for repositories that want to run `tbd integration sync` by hand.

### Naming

The command group is **`tbd integration`** and the config key is `integrations`. PR #197
used `bridge`; `integration` matches how this capability is described everywhere else in
the project and reads better for GitHub, where “bridge” implies more symmetry than PR
linking actually has.
The one-way projection is **`tbd integration sync --push`**. Earlier drafts used a
`mirror` verb, but the final CLI deliberately shares the same directional vocabulary as
`tbd sync`.

### Module layout

```
packages/tbd/src/
├── lib/
│   ├── env-file.ts                    # ✅ .env discovery + util.parseEnv wrapper
│   └── issue-hierarchy.ts             # ✅ parent_id cycle/depth guard
├── integrations/
│   ├── core/
│   │   ├── types.ts                   # ✅ TrackerAdapter, ExternalIssue, CanonicalPatch,
│   │   │                              #    ProviderMeta, MirrorPlan; +ConflictReport (P2)
│   │   ├── credentials.ts             # ✅ resolveCredential(), maskSecret()
│   │   ├── registry.ts                # ✅ providerFor(name), configured()
│   │   ├── selection.ts               # ✅ mirrorSet(issues, select): Issue[]
│   │   ├── link-store.ts              # ✅ readLink/writeLink/clearLink on extensions.<p>
│   │   ├── link-guard.ts              # ✅ remote tbd claim probe and force boundary
│   │   ├── managed-block.ts           # ✅ renderManagedBlock(), spliceManagedBlock()
│   │   ├── permalink.ts               # ✅ specPermalink(spec_path, bead): URL
│   │   ├── mirror.ts                  # ✅ planMirror() pure, applyMirror()
│   │   ├── bulk-guard.ts              # ✅ create/update thresholds, non-interactive refusal
│   │   ├── policy.ts                  # ✅ presets, PolicyDefinition resolution
│   │   ├── bridge-state.ts            # ✅ per-link records + newest-observation merge
│   │   ├── reconcile.ts               # ✅ reconcile(base, local, remote, rules), pure
│   │   └── intents.ts                 # ✅ write-ahead intent journal + replay
│   ├── linear/
│   │   ├── client.ts                  # ✅ gql(), rate-limit handling, pagination
│   │   ├── adapter.ts                 # ✅ LinearAdapter implements TrackerAdapter
│   │   ├── mapping.ts                 # ✅ status/priority/label tables (pure)
│   │   └── queries.ts                 # ✅ query/mutation strings + zod response schemas
│   └── github/                        # P3, same shape as linear/
└── cli/commands/
    └── integration.ts                 # ✅ status|sync|link|unlink|comment
```

(✅ = implemented in PR #206; P3 is planned here.)

Dependency direction: `cli/commands/integration.ts` → `integrations/core` → provider
modules. Nothing in `file/` or `lib/` imports from `integrations/`; the `LinkedEntry`
payload schema and the merge rules live in the existing `lib/schemas.ts` and
`file/git.ts` because they are part of the entity model, not the integration.

### Post-v0.5 execution map

This is the authoritative remaining-work map.
Every row is a bead with its code seam and proof obligation; descriptions on the beads
carry the full function-level test cases.

| Order | Bead | Files and functions | Completion proof |
| --- | --- | --- | --- |
| Linear integrity | `tbd-zlej` | `lib/ids.ts` `extractShortId()` / `extractPrefix()`; `lib/schemas.ts` `ExternalIssueIdInput`; the shared display-prefix grammar | Every prefix accepted by init/setup resolves through ordinary and integration commands; invalid inputs still fail |
| Linear integrity | `tbd-3qfj` | `core/link-store.ts` duplicate grouping; `core/sync-engine.ts` `runSync()`; `core/intents.ts` `replayIntents()`; `cli/commands/doctor.ts` `checkIntegrations()` | Pre-existing many-beads-to-one-item state cannot push or replay stale writes; every holder is named; unrelated pairs continue |
| Linear direction | `tbd-qc17`, `tbd-hfwb`, `tbd-c863`, `tbd-0lt1`, `tbd-5s77` | `cli/commands/integration.ts` `pushOnlySelector()`; `cli/lib/integration-runner.ts` `runEnabledIntegrationPushes()`; `cli/commands/sync.ts` `runIntegrationPushInPosition()`; `core/sync-engine.ts` replay/inbound gates | Outbound selectors fail without `--push`; both top-level and integration `--push` use the outbound projection; `--pull` performs no provider mutation or newly journaled suppressed write, even for inbound creation or pending crash journals |
| Linear linking/inbound | `tbd-pr5e`, `tbd-utuy`, `tbd-pqi6`, `tbd-f3uc` | `integration.ts` `IntegrationLinkHandler` and `--external`/`--force`; `integration-runner.ts` ref resolution; `core/link-guard.ts`; `sync-engine.ts` `importExternal()`; `TrackerAdapter.listAttachmentUrls()`; Linear attachment query | Named refs bypass inbound policy under `--pull`; duplicate refs collapse; foreign claims fail before local creation; manual and inbound ownership upserts have durable intents; attachment failure replays without a duplicate bead or link |
| Journal integrity | `tbd-bd8z` | `core/intents.ts` `listIntentFiles()` / `replayIntents()` | A missing journal directory is empty; unreadable, malformed, or schema-invalid journal files fail closed with their filename before any provider mutation, preserving create client UUIDs and preventing duplicates |
| Comment replay integrity | `tbd-5p9k` | `core/intents.ts` `post_comment` identity and `replayIntents()` recovery callback; `core/sync-engine.ts` recovered working set; `comment-store.ts` `recordPushedComment()` | A crash after the provider accepts a comment cannot cause the recovery run to mint a second UUID: the journal carries bead and local-comment ids, replay records the provider id and commits it while the journal remains durable, and planning sees that recovered bead |
| Folded sync integrity | `tbd-yp81`, `tbd-dc77` | `cli/commands/sync.ts` `assertIntegrationReportsHealthy()`, surface rollup, and config preflight | Thrown and per-item tracker failures both let independent docs/issues finish but force a non-zero aggregate result; malformed config never turns integrations silently inert |
| Conflict durability | `tbd-l50w`, `tbd-ofwz`, `tbd-jemr` | `file/attic-entry.ts`; `SyncCallbacks.archiveConflict()`; `intents.ts` `post_conflict`; `sync-engine.ts` archive-before-journal-before-write ordering | The exact losing prose is archived before either side changes; crash and inbound-only deferral reuse the same archive/comment UUID and settle exactly once |
| Attic recovery | `tbd-anx3`, `tbd-z7n8`, `tbd-vzt1`, `tbd-y45b` | `attic.ts` `parseAtticFilename()`, `resolveAtticIssueId()`, `decodeAtticTextValue()`, `buildRestorationAtticEntry()` | Real ULID filenames and display IDs work; JSON/legacy/null values restore exactly; the displaced winner is reverse-archived first |
| Link liveness | `tbd-q0yh` | Linear `ISSUES_BY_ID_QUERY`; `sync-engine.ts` linked-item liveness fetch and orphan transition | Quiet archive/delete is detected outside the watermark; no bead is deleted or closed; repair remains explicit |
| Source hygiene | `tbd-sl7f`, `tbd-xu8f` | `cli/commands/attic.ts` optional-field restoration; `lib/comment-union.ts` canonical key separator | Static optional-field deletion satisfies type-domain lint; source contains an escaped NUL spelling rather than a literal binary byte while runtime keys remain unchanged |
| Linear live gate | `tbd-40el` | Built CLI plus `tests/qa/linear-integration.qa.md`; bridge link and intent records | Link/take/unlink/relink, comments, deliberate conflict, and two-clone convergence pass against the pilot |
| Linear RC decision | `tbd-jud3` | Package, docs, installed skills, PR #206 review and hosted checks | All local and hosted release gates are final green with an explicit RC disposition |
| GitHub transport | `tbd-lmo9` | New `integrations/github/{client,queries,mapping,adapter}.ts`; `credentials.ts`; `registry.ts`; `status.ts` | Mock API contract, credential fallback, mapping, pagination, permission and rate-limit tests pass |
| GitHub issues | `tbd-tnks` | Existing `integration.ts`; `core/{mirror,sync-engine,intents,reconcile,link-store,link-guard}.ts` through the GitHub adapter | Link, explicit inbound selection, outbound projection, two-way sync, comments, and unlink settle to a second-run no-op |
| GitHub PRs | `tbd-v75l` | `extensions.github.prs` helpers and PR CLI verbs; Linear attachment upserts | PRs remain read-only implementation associations; link/unlink/refresh is idempotent and coexists with an issue link |
| GitHub release gate | `tbd-v1u1`, `tbd-xbkm` | Real built CLI, live disposable issue/PR, manual/design/install docs | Mock and bounded live E2E pass; pilot is cleaned up; docs and package artifacts agree |
| Web query/data | `tbd-qsda`, `tbd-6yxi` | `lib/issue-query.ts`; `list.ts`; `cli/web/board.ts` `parseBoardQuery()`, `buildBoardResponse()`, `getBead()` | Shared `--linked` semantics, conditional counts, allow-listed additive response data, immediate local updates |
| Web presentation | `tbd-6k5g`, `tbd-35mn` | `web/core.ts`; `web/client.ts` `renderRow()` / `renderLoadedBody()`; `web/styles.css`; web package/docs tests | Accessible Linear/GitHub links and filters ship in the self-contained page without remote access or row-width regressions |

Dependency order is explicit in tbd: the live Linear soak depends on both integrity
guards; the final Linear RC gate depends on the soak; GitHub issue behavior depends on
the adapter, the GitHub live gate depends on issue and PR behavior, and web rendering
depends on the allow-listed server projection.
The web work can ship for Linear before the GitHub adapter: the response shape is
provider-generic and the GitHub option simply has a zero count until links exist.

### Components

#### 1. Credentials and `.env` (`src/lib/env-file.ts`, `src/integrations/core/credentials.ts`)

```ts
// lib/env-file.ts
export async function readEnvFile(repoRoot: string): Promise<Map<string, string>>;
// Reads <repoRoot>/.env if present; parses with util.parseEnv; returns a Map.
// NEVER writes into process.env — see the leak constraint below.

export async function checkEnvIgnored(repoRoot: string): Promise<boolean>;
// `git check-ignore .env`; used by status/doctor and by setup.

// integrations/core/credentials.ts
export interface ResolvedCredential {
  value: string;           // never serialized; see SecretString note
  source: 'env' | 'dotenv' | 'gh-cli';
}
export async function resolveCredential(
  provider: ProviderName, repoRoot: string,
): Promise<ResolvedCredential | undefined>;
export function maskSecret(value: string): string;  // "lin_api_…3kfa" (last 4)
```

Resolution order, first match wins, per provider:

1. Process environment (`LINEAR_API_KEY`, `GITHUB_TOKEN`).
2. `.env` in the repo root, via `readEnvFile()`.
3. For GitHub only, `gh auth token` if the CLI is present and authenticated.

Rules, each enforced by a test:

- **`.env` values never enter `process.env`.** `buildGitEnv()` spreads `process.env`
  into every git subprocess, and git runs user hooks; loading the key into the process
  environment would hand it to every hook.
  Credentials travel only through `ResolvedCredential` values passed to provider
  clients.
- `.env` is read, never written.
  `tbd integration status`, `tbd doctor`, and `tbd setup` all **fail loudly if `.env`
  exists and is not gitignored**, rather than risking a committed key.
- Values are never logged, never written to bridge state, and never included in `--json`
  output. Only presence, `source`, and `maskSecret()` output are reported.

#### 2. Status and doctor (`cli/commands/integration.ts`, `cli/commands/doctor.ts`)

```
tbd integration status [--provider <p>] [--json]
```

`IntegrationStatusHandler extends BaseCommand`. Per configured provider, it reports:

| Probe | Implementation |
| --- | --- |
| configured | `integrations.<p>.enabled` in config |
| credential | `resolveCredential()` — present, source, mask |
| `.env` hygiene | `checkEnvIgnored()` |
| credential valid | Linear: `gql('{ viewer { id } }')`; GitHub: `GET /user` |
| target resolvable | Linear: team key → UUID via `ensureMeta()`; GitHub: repo exists |
| metadata cache | age of `bridge/<p>/meta.yml` |
| links | count from `bridge/<p>/links/`; drift = links whose base differs from the current bead |

Exit codes: 0 all probes pass (or nothing configured — that is a valid state, reported
with setup guidance); 1 any probe fails.
Every failure carries a one-line remedy ("Set LINEAR_API_KEY in .env — create one at
linear.app/settings/api").

`tbd doctor` gains one `safeCheck('Integrations', …)` entry calling the same probe
functions, **skipped entirely (not failed) when no provider is enabled**, so doctor
stays green and offline-safe for repositories that never use this.
Network probes get a short timeout and degrade to “unreachable (network?)” rather than
error.

#### 3. Link storage: the `extensions` namespace (`integrations/core/link-store.ts`)

The link lives under `extensions.<provider>`, which `BaseEntity` already carries.
It is **not** a new top-level field, and that difference is not cosmetic.

```yaml
extensions:
  linear:
    id: 9cbb48f8-7a2e-4b9d-9f3e-0c1d2e3f4a5b   # provider UUID, the canonical key
    key: FIN-123                                # human identifier, display only
    url: https://linear.app/acme/issue/FIN-123
    linked_at: 2026-08-10T18:00:00Z
```

Measured against tbd 0.4.2, writing each shape and then running `tbd update`:

| Storage | Older tbd on write | Format bump |
| --- | --- | --- |
| Top-level `linked:` | **silently dropped** | required |
| `extensions.linear` | **survives intact** | not needed |

`IssueSchema` parses in Zod strip mode, so an unknown top-level field is discarded the
first time an older CLI writes the bead.
`extensions` is a *known* field whose contents are `z.unknown()`, so there is nothing to
strip. The failure this avoids is specific: a dropped link means the bead forgets it is
mirrored, so the next mirror creates a **duplicate** external issue and orphans the
original.

This is what `extensions` is for: keep the feature soft and additive now, and promote it
to a first-class field later if it earns one, with a format bump that is actually
justified.

- The UUID is canonical because Linear identifiers move between teams; UUIDs do not.
- In Phase 2 the same namespace also carries the append-only `comments` entries — see
  [Comments](#comments-append-only-sequences-not-merged-fields).
- **“At most one link per provider” is structural**, not enforced: the namespace key
  *is* the provider, so there is no second entry to collapse and no merge rule needed.
  A bead can hold a Linear link and a GitHub link at once, each merged independently.
- `LinkedEntry` remains in `lib/schemas.ts` as the payload shape, validated on read out
  of the namespace rather than as a schema field.
  A malformed namespace reads as unlinked rather than throwing, so a hand-edited bead
  cannot break a mirror run.
- The per-namespace `extensions` merge (`tbd-le2l`) is a **prerequisite**: whole-object
  LWW would drop a real link when two writers touch different namespaces.
  *(Shipped in Phase 1.)*
- `last_actor` is **cut**, not deferred: echo suppression falls out of base comparison
  (see the [sync design](#10-sync-corebridge-statets-corereconcilets-coreintentsts)), so
  an actor field would be purely informational.
  If watch attribution ever wants one, it can ride `extensions.tbd` additively.

#### 4. Where PR and repo links live on the bead

The mirror surfaces PR links in Linear, and those links need a bead-side home.
There is no PR field today, and adding one is premature.
Decision: **the `extensions.github` namespace**, written by tooling once the
per-namespace merge fix lands:

```yaml
extensions:
  github:
    prs: ["https://github.com/jlevy/tbd/pull/205"]
    issue: "https://github.com/jlevy/tbd/issues/123"
```

This is why the `tbd-le2l` fix (`extensions` from whole-object `lww` to per-namespace
merge, arrays unioned) is a Phase 1 prerequisite rather than a nicety: without it, the
`github` namespace and any other writer’s namespace clobber each other.

#### 5. Embedding full bead content in Linear (`core/managed-block.ts`, adapter)

Linear has no custom fields, so the fields it cannot represent need a home.
Use **both** carriers, for different readers:

**Machine-readable: attachments, keyed by stable tbd URLs.** `attachmentCreate` upserts
on `url` — the one naturally idempotent, retry-safe write in the API:

| Attachment `url` | Content |
| --- | --- |
| `tbd://bead/<id>` | `title`: `<id> · <kind>`; `subtitle`: `<status> · P<n> · children/ready counts`; `metadata`: full canonical field set (nested values verified to work) |
| `tbd://bead/<id>/spec` | The plan spec **permalink** (below) |
| `tbd://bead/<id>/repo` | The bead file on the sync branch |
| (native) | GitHub PR/issue links via `attachmentLinkGitHubPR` / `attachmentLinkGitHubIssue`, so Linear renders them with its own PR UI |

**Human-readable: a managed block in the description.**

```ts
// core/managed-block.ts
export function renderManagedBlock(bead: Issue, links: MirrorLinks): string;
export function spliceManagedBlock(description: string, block: string):
  { result: string } | { error: 'markers-malformed' };
```

```markdown
<!-- tbd:begin -->
`tbd-gvju` · epic · in_progress · P1
Spec: [plan-2026-08-10-external-tracker-integrations.md](<permalink>)
PRs: #205 · Children: 7 (3 ready) · `tbd show tbd-gvju`
<!-- tbd:end -->
```

Only the region between markers is rewritten, so human prose outside it survives.
Missing markers → append; malformed markers → **report and skip**, never guess.

**Spec permalinks** (`core/permalink.ts`): `spec_path` is a path into a branch-local
file (15 specs on this branch, 11 on `main` — four exist on only one branch).
`specPermalink()` resolves which branch has the file (`git ls-tree <branch> -- <path>`
against the branches the bead’s work is on, falling back to `main`) and emits
`blob/<branch>/<path>` while in flight, rewritten to `blob/<merge-sha>/<path>` when the
bead closes.

#### 6. The linking policy

<a id="the-linking-policy"></a>

One structured object per integration answers all four questions from the
[Approach](#approach).
`policy` accepts either a **preset name** or an **inline definition**, so a repo starts
with one word and customizes only when it outgrows it:

```yaml
integrations:
  sync_on_tbd_sync: false    # run enabled integrations inside plain `tbd sync`
  linear:
    enabled: true
    team_key: TBD
    project: tbd             # optional; scopes creates and the inbound scan
    policy: default          # preset name — or the inline form below
    mirror_labels: false     # push bead labels as `tbd:`-prefixed Linear labels
    create_labels: true      # create missing labels when mirror_labels is on
    max_nesting: 2           # levels of sub-epic mirrored
    user_map: {}             # tbd assignee -> Linear user, needed before assignee sync
  # github:
  #   enabled: true
  #   repo: owner/name
```

The inline form, shown with the values the `default` preset expands to:

```yaml
    policy:
      outbound:              # when a bead should create a tracker issue
        kinds: [epic]
        statuses: [open, in_progress, blocked]
        labels: []
        specs: active        # none | active | any — beads whose spec is in specs/active/
        linked: true         # already-linked beads always participate
      inbound:               # when a tracker issue should create a bead
        mode: report         # off | report | auto
        labels: []           # only items carrying one of these labels (empty: any)
        as_kind: task        # kind assigned to inbound-created beads
      field_sync:            # how a linked pair's fields and comments flow
        fields:
          title: merge       # merge | local | remote
          description: merge
          status: merge
          priority: merge
          labels: local
          assignee: local
        comments: two_way    # two_way | inbound | outbound | off — see Comments below
        tie_break: newest    # newest | local | remote — both-sides-changed fallback
```

`PolicyName = z.enum(['default'])` today;
`policy: z.union([PolicyName, PolicyDefinitionSchema])`. New presets are additions to an
enum and a table, which is the whole point of naming them: a future `policy: full-sync`
or `policy: triage-only` is one line in a repo’s config and zero migration.
(The Phase 1 `select` key is the `outbound` clause by its old name; it is folded into
`policy.outbound` during config load and documented as deprecated.)

Clause semantics:

- **`outbound`** — a selector over beads, evaluated by `mirrorSet()` which reuses the
  predicates in `lib/issue-selection.ts` (the same module `list`/`ready`/`changes`
  share). Rules are OR’d (a bead qualifies by kind *or* by spec), then gated by
  `statuses`. The default names the recommended practice: **major epics and beads with
  active specs, typically ~10% of open work** — not the whole store.
- **`inbound`** — a selector over external items in the configured team/project that are
  not linked to any bead.
  `mode: off` ignores them; `report` (the default) lists them in `status` and `sync`
  output with ready-to-run `sync --pull --external` commands; `auto` creates beads for
  them during `sync`. `auto` is the “PM files a ticket in Linear, an agent picks it up
  as a bead” loop, and it stays opt-in because it lets people outside the repo create
  work inside it.
- **`field_sync`** — flow rules for linked pairs.
  `merge` is full three-way (either side can change it; both-sides changes conflict).
  `local` means tbd owns it: pushed outward, and a tracker-side edit is overwritten on
  the next sync — **reported, never silent**. `remote` is the reverse.
  Defaults: content and triage fields merge, per the principle that **linked pairs
  converge**; `labels` stays local because pulling a team’s label taxonomy into beads
  imports noise; `assignee` stays local because tracker assignees are people
  (names/emails), and nothing person-identifying lands in beads without an explicit
  `user_map` and an explicit `assignee: merge`. The `comments` mode governs the
  append-only comment sequences described in
  [Comments](#comments-append-only-sequences-not-merged-fields).

**Bulk-change guard.** Any run that would create more than **20** items or update more
than **40** — in either system, in either direction — requires confirmation.
Interactive runs prompt; non-interactive runs **refuse with exit 1** and name the
`--yes` remedy, so CI can neither hang nor silently apply a sweeping change.
(`CREATE_CONFIRM_THRESHOLD` / `UPDATE_CONFIRM_THRESHOLD` in
`integrations/core/bulk-guard.ts`, shared by outbound projection, inbound creation, and
full sync. The thresholds exist because the failure mode is real: an early pilot run
pushed 112 bead labels into a shared team namespace.)

**Nested epics** are supported in tbd but mirrored at most `max_nesting` levels deep,
because Linear’s data model nests arbitrarily while its *views* flatten past about two
levels. Deeper structure stays in beads where `tbd dep` and `tbd web` render it.
The `parent_id` cycle/depth guard (Phase 1) ensures a cycle cannot hang the mirror.

#### 7. Field mapping (`linear/mapping.ts`, pure functions)

```ts
export function statusToLinear(s: IssueStatus): { stateType: string; labels: string[] };
export function statusFromLinear(stateType: string, labels: string[]): IssueStatus;
export function priorityToLinear(p: Priority): number;
export function priorityFromLinear(n: number): Priority;
```

Status, resolving Linear state UUIDs by `type` per team (cached in `meta.yml`). The
`type` value set is treated as **open**: unknown types map to `open` with a warning.

| tbd status | to Linear type | from Linear type |
| --- | --- | --- |
| `open` | `unstarted` | `triage`, `backlog`, `unstarted` |
| `in_progress` | `started` | `started` |
| `blocked` | `started` + label `tbd:blocked` | `started` + that label |
| `deferred` | `backlog` + label `tbd:deferred` | that label |
| `closed` | `completed`, or `canceled` when `close_reason` indicates it | `completed`, `canceled`, `duplicate` |

Priority. Linear `0` means **no priority set**, not “lowest”, so the mapping is
deliberately not a bijection:

| tbd | to Linear | from Linear |
| --- | --- | --- |
| P0 | 1 Urgent | 1 |
| P1 | 2 High | 2 |
| P2 | 3 Medium | 3, **and 0 (unset)** |
| P3 | 4 Low | 4 |
| P4 | 4 Low | — |

Pulling an unprioritized Linear issue yields the tbd default (P2), not P4. The P4→4→P3
round-trip loss is accepted and documented.

Labels map by exact name; tbd-owned labels are prefixed `tbd:`.

#### 8. Linear client (`linear/client.ts`, `linear/queries.ts`)

```ts
export class LinearClient {
  constructor(credential: ResolvedCredential, baseUrl?: string);  // baseUrl for mock
  async gql<T>(query: string, variables: object, schema: z.ZodType<T>): Promise<T>;
}
```

- `Authorization: <key>` raw header (no `Bearer` for API keys).
- Checks the GraphQL `errors` array — partial success arrives with HTTP 200.
- `RATELIMITED` on HTTP 400 → backoff to `X-RateLimit-Requests-Reset`, bounded retries.
- Reads `X-RateLimit-Requests-Remaining`; warns below a floor rather than trusting the
  (wrong) documented quota.
- Pagination helper capped at `first: 250`.
- Every response validated with a zod schema from `queries.ts` — malformed responses
  fail with the query name, not a deep property error.
- `LINEAR_API_URL` env override for the mock server; the credential is still required so
  tests exercise the auth path.

`ensureMeta()` (in `adapter.ts`) fetches team workflow states (UUID by `type`) and
labels into `bridge/linear/meta.yml`; refreshed when a push hits an unknown state or
label, and on `tbd integration status --refresh`.

#### 9. Mirror (`cli/commands/integration.ts` → `core/mirror.ts`)

```
tbd integration sync --push [--bead <ids...>] [-t <kind>] [--status <s>] [-l <label>]
                       [--spec <path>] [--limit <n>] [--yes] [--dry-run] [--json]
```

With no selectors, the policy’s `outbound` clause applies; any selector overrides it
wholesale. These selectors are push-only: bare sync always reconciles every linked pair,
and a selector without `--push` is rejected rather than ignored.
Plan/apply split so `--dry-run` is the same code path minus writes:

```ts
export function planMirror(context: MirrorContext): MirrorPlan;
  // pure: creates, updates, attachment upserts, block splices, skips
export async function applyMirror(options: ApplyOptions): Promise<MirrorReport>;
```

Ordering per bead: create (client UUID, duplicate-id error treated as success) or
`issueUpdate` → upsert attachments → splice managed block → record the link in
`extensions.<provider>` (creates only after the item verifiably exists).
Parents mirror before children so `parentId` can be set.
Re-running with no changes is a no-op.

On every update the adapter re-reads the item’s `key`/`url` and refreshes the stored
link when they changed — Linear identifiers are team-scoped (`FIN-11` becomes `TBD-4` on
a team move), and the pilot’s team move exercised exactly this: 0 creates, 80 updates,
every key refreshed, because links are keyed on the immutable UUID.

The `patch` **omits `labels` entirely** unless `mirror_labels` is on: sending `[]` would
strip labels a human applied in the tracker, which is not ours to remove.

Cost envelope: ~84 items × ~4 calls ≈ 340 requests on a full run, far under 2,500/hour;
steady-state runs are mostly no-ops.

#### 10. Sync (`core/bridge-state.ts`, `core/reconcile.ts`, `core/intents.ts`)

The sync engine reconciles every linked pair, then applies the policy’s `outbound` and
`inbound` clauses to unlinked work on both sides.
It is built on four ideas, each of which earns its place by a specific failure it
prevents:

1. **A recorded base makes reconciliation three-way.** Without a base, “remote title
   differs from bead title” is ambiguous (who changed it?). With one, one-sided changes
   flow silently and only genuine both-sides changes conflict.
2. **Correctness never depends on timestamps or clocks.** `updatedAt` bounds *what to
   fetch*; field-versus-base comparison decides *what changed*. Echo suppression falls
   out for free: after a push, base equals the pushed values, so re-fetching our own
   write produces an empty diff.
   No actor filtering, no clock trust, works with a plain API key.
3. **External writes are journaled before they happen** (write-ahead intents), and every
   external write is idempotent or replay-safe.
   When replay recovers an external identity (an issue id or posted-comment id), it
   records and commits that identity locally while the journal is still present, then
   removes the journal.
   A crash at any boundary thus either completes or repeats harmlessly without losing
   the local↔external identity.
4. **The base advances only after the work is recorded** — the `tbd-rdsb` lesson, where
   a migration reported success for work it never committed and then deleted the source.
   Sync reports distinguish “nothing to do” from “did something” for the same reason.

##### Bridge state: one record per link, merged like everything else

Bridge state lives on the `tbd-sync` branch, one directory per provider:

```
.tbd/data-sync/bridge/linear/
├── links/<bead-id>.yml     # one record per link (shape below)
├── intents/<run-id>.yml    # write-ahead journal; directory empty in steady state
└── meta.yml                # cached workflow states by type + label ids
```

```yaml
# links/is-01kzn510qqbk3ax3pbw447xw8y.yml
type: lk
bead_id: is-01kzn510qqbk3ax3pbw447xw8y
external_id: 9cbb48f8-7a2e-4b9d-9f3e-0c1d2e3f4a5b   # provider UUID, canonical
base:                        # canonical (tbd-space) values at last reconciliation
  title: "tbd integration link / unlink / explicit inbound selection"
  status: open
  priority: 1
  description_hash: "sha256:…"   # hash, not text — see security note
remote_updated_at: 2026-08-10T22:14:03.512Z          # provider's clock, prefilter only
synced_at: 2026-08-10T22:14:05.001Z
state: linked                # linked | orphaned
```

Design points, in decreasing order of importance:

- **Per-link files, not one `state.yml`.** Two machines can sync concurrently (the
  data-sync lock is per-machine), and their commits meet in a git merge on `tbd-sync`. A
  single YAML file would produce textual merge conflicts; per-link files reduce every
  merge to file granularity, and same-file merges resolve by a one-line rule: **the
  newer observation wins** (higher `remote_updated_at`, then `synced_at`). Both sides
  are observations of the same external truth, so this is conflict-free by construction.
  Implemented as a new record type in the existing merge dispatch in `file/git.ts` — the
  same machinery that merges issues, not a second merge system.
- **The bead carries identity; the bridge carries dynamics.** The bead’s
  `extensions.linear` holds only `{id, key, url, linked_at}` (the Phase 1 allow-list).
  The base tuple, watermarks, and journal churn on every sync and belong on the sync
  branch, not in bead history.
- **Scalars verbatim, prose hashed.** The base stores small canonical fields directly
  but only a **normalized hash** of the description.
  Change detection needs equality, not content; the conflict path has both live values
  in hand. This keeps bridge records small and honors the rule that no extraneous tracker
  data lands in the repo.
- **The pull watermark is derived, not stored**: fetch items with
  `updatedAt > max(remote_updated_at across links) − overlap` (generous overlap;
  over-fetching is free because the base comparison discards no-ops).
  One filtered query, one or two pages for a few-hundred-item project — trivial against
  the 2,500/hour budget.

##### The reconcile algorithm (`core/reconcile.ts`, pure)

For each linked pair:
`reconcile(base, local, remote, policy.field_sync) → {beadPatch, externalPatch, conflicts[]}`,
per field:

| local vs base | remote vs base | outcome |
| --- | --- | --- |
| unchanged | unchanged | nothing |
| changed | unchanged | push to tracker |
| unchanged | changed | pull into bead |
| changed | changed, same value | converged; advance base only |
| changed | changed, different | **conflict** → field rule |

A field owned `local` or `remote` short-circuits the matrix: the owner’s value flows, an
opposite-side edit is overwritten **and reported** in the run output.
For `merge` fields the conflict falls to `tie_break` (default `newest`, comparing the
bead’s `updated_at` to the item’s `updatedAt` — best effort across clocks, which is
acceptable for a tie-break of last resort; `local`/`remote` pin it per repo).

Every conflict, regardless of winner, produces both durable artifacts:

- the exact losing value — local **or remote**, including the real prose rather than a
  description hash — goes to the **attic before either side is overwritten**;
- a **comment on the external item** via `postConflict()` names the field, both values,
  the winner and why, and the attic path.
  Under `--pull` this write is journaled locally and posted by the next full sync,
  preserving the no-external-write boundary without losing the notice.
  Comments get the `commentResolve` lifecycle, so “unresolved conflict comments” is a
  queryable state for humans and agents; `status` counts them, and the bridge record
  keeps the comment id.

Description is compared **after normalization** (strip the managed block, normalize line
endings and trailing whitespace) so tbd’s own splice and Linear’s markdown
round-tripping never register as remote edits.
Pushes re-splice the managed block around the merged body.

##### Comments: append-only sequences, not merged fields

<a id="comments-append-only-sequences-not-merged-fields"></a>

Comments are the one kind of content whose synchronization is *easier* than fields, and
the design leans on why: **a posted comment is immutable and has a stable id**, so both
sides are append-only sequences.
Synchronizing two append-only sequences needs no base, no three-way, and no conflict
handling — the merged state is the **union by id, ordered by creation time**. Each
comment is handled individually, in sequence.

Storage rides the link namespace the bead already carries — the external payload lists
the immutable comment ids alongside the issue UUID, and the entries carry the content:

```yaml
extensions:
  linear:
    id: 9cbb48f8-…                    # issue UUID (Phase 1)
    key: TBD-12
    url: https://linear.app/…
    linked_at: 2026-08-10T18:00:00Z
    comments:                         # append-only, ordered by `at`
      - id: 41f2c3d4-…               # Linear's immutable comment UUID
        at: 2026-08-11T02:10:00Z
        author: "Joshua Levy"         # display name only, never an email
        body: "Ship it after the soak."
      - local_id: 01J4X5…             # ulid minted at authoring; no id yet = not pushed
        at: 2026-08-11T02:12:00Z
        author: tbd
        body: "Blocked on the rate-limit probe."
```

- **Identity.** An inbound comment’s identity is the provider’s immutable comment UUID.
  An outbound comment is authored with a ulid `local_id` (time-ordered, so local
  sequence order is intrinsic); pushing it posts `commentCreate` and records the
  returned UUID onto the entry.
  Its intent durably carries the bead id, `local_id`, and client UUID. Replay first uses
  provider UUID dedup, then records that returned UUID on the exact local entry and
  commits the recovery while the intent still exists.
  The recovered bead replaces the stale input in the current run’s working set, so the
  same run cannot re-plan that comment with a fresh UUID.
- **Merge.** The `comments` array inside a provider namespace merges by **union on
  id/`local_id`** — the one array-typed key in the namespace with union semantics, a
  bounded extension of the per-namespace merge.
  Namespace deletion (unlink) still wins as absence.
  Two machines appending different comments both survive; the same comment arriving
  twice dedupes on its id.
- **Flow.** `field_sync.comments: two_way` (default) pulls new external comments and
  pushes local-authored ones each sync; `inbound` / `outbound` restrict direction; `off`
  disables. Local authoring: `tbd integration comment <bead> "text"` appends an entry and
  works offline — it pushes on the next sync.
  The conflict-report comments from the field engine ride this same rail (they are
  simply comments authored by tbd, with their resolve lifecycle tracked in the bridge).
- **Bounds.** Stored bodies are capped (10 KB per comment, 50 comments per bead; older
  entries collapse to `{id, at, author}` stubs with a “full text in Linear” pointer) so
  a chatty tracker thread cannot bloat a bead file.
  Caps are constants first, config only if someone actually needs different ones.
- **What does not sync**: edits and deletions (append-only means the sequence keeps the
  original; a Linear-side edit is ignored, documented), reactions, and threading (Linear
  child comments flatten in `at` order, marked `in_reply_to` if we ever need it back).
- **Security.** The entry shape is an allow-list like the link payload: id, timestamp,
  author *display name*, body.
  No emails, no avatars, no raw payloads.
  Comment content is the one place tracker-authored prose enters the repo, and that is
  exactly what the user asked comments sync to do — but it enters as data written by the
  normal bead write path, never interpreted as instructions.

This deliberately reuses the Phase 1 storage philosophy: comments live in `extensions`
now, additively and with no format bump, and can be promoted to a first-class `comments`
field later if they earn it.

##### Applying: intents, idempotency, and honest completion

Apply order per run, under the existing data-sync lock:

1. **Replay** any intent files left by a crashed run (theirs or ours — idempotency makes
   cross-machine replay safe).
   Recover issue links and pushed-comment ids into their beads, commit those identities
   while the intent remains durable, then delete the completed intent.
   Planning uses this recovered working set, not the stale caller snapshot.
2. **Archive conflict losers, then write intents** for every planned external write,
   with client-generated UUIDs for creates and conflict comments; commit the archives
   and journal to the sync branch together.
3. **Apply external writes**, per-pair failure containment (one unreachable item marks
   the run degraded, the rest proceed).
4. **Apply bead patches** through the normal issue write path — version bump,
   `updated_at`, attic, `changes`/`watch` events all come for free.
5. **Advance bases** (write bridge records) and delete intents; commit.
   A failure before this commit leaves intents in place, and step 1 of the next run
   completes the work. The run report states created/updated/pulled/conflicted counts and
   says explicitly when nothing needed doing.

Replay safety is per-operation, verified against the mock server:

| Operation | Replay behavior |
| --- | --- |
| `issueCreate` (client UUID) | duplicate-id error ⇒ treat as success, fetch by id, recover the link if the bead missed it |
| `issueUpdate` | idempotent (same values) |
| `attachmentCreate` | true upsert on `url` |
| `commentCreate` (user comments) | journal carries bead id + local id + client UUID; provider dedup returns that UUID; replay commits it onto the local entry before intent cleanup and current-run planning |
| `commentCreate` (conflict reports) | journaled report plus client-UUID dedup; replay reuses the committed archive path and does not re-plan a remote-win report in the recovery run |

##### Linking and inbound creation: where a pair begins

- **Mirror-create** (bead → new item): base := the pushed values.
  Unambiguous.
- **`sync --pull --external <ref>`** (item → new bead): a link plus a one-shot
  all-`remote` pull, independent of the configured inbound selector.
  The bead gets canonical fields only — title, mapped status and priority, description
  (managed-block-stripped), `as_kind` from the policy.
  No labels, no assignee, no raw payload.
  Base := the imported values.
- **`link <bead> <ref>`** (both exist — the only ambiguous case): equal fields converge
  silently; for differing fields there is no honest automatic answer, so the command
  shows the field diff and asks.
  `--take local` / `--take remote` answers wholesale; non-interactive runs without a
  stance **refuse with exit 1** (the bulk-guard philosophy: never hang, never guess).
- **One-source guard, both directions.** Bead → one item per provider is structural (the
  namespace key is the provider).
  Item → one bead is enforced at link/inbound-creation time against the bridge’s reverse
  index, every bead link in the local store, and a cross-repo probe: an item already
  carrying a `tbd://bead/<other-id>` attachment is refused without `--force`, because
  two writers double-writing one item is the ping-pong failure this design exists to
  prevent. Every import journals the idempotent claim before provider I/O. A normal sync
  consumes it only after the upsert succeeds; `--pull` leaves it locally for the next
  full sync. The probe prevents ordinary sequential duplication but is not an atomic
  distributed lock.

##### Unlink, orphans, and deletion — absence is never silently undone

- **`unlink`** removes `extensions.<provider>` from the bead and the bridge record.
  The per-namespace merge treats absence as a value (Phase 1), so a concurrent writer
  cannot resurrect the link; a later `sync --push` would create a *new* item only if the
  policy still selects the bead, and says so.
- **Remote item archived or deleted** → bridge `state: orphaned`, reported by `status`
  and `sync`; the bead is **never** auto-deleted or auto-closed.
  `unlink` or `link` to a new item clears it.
- **Bead deleted or closed** → the external item is updated (closed maps to
  `completed`/`canceled`) but never deleted.
  tbd never destroys tracker data it did not create.

##### What sync will not write

The Phase 1 security rules extend to the new surfaces, each backed by a test:

- Into **beads**: canonical fields via the mapping tables, the four-key link payload,
  and allow-listed comment entries (id, timestamp, author display name, capped body) —
  never raw API responses, emails, or workspace metadata.
- Into **bridge records** (committed to git): the shape above and nothing else — ids,
  canonical base scalars, a hash, two timestamps, a state enum.
- Into **Linear**: bead content and the managed block — never credentials, `.env`
  contents, or local paths beyond the repo-relative spec path.
- Credentials continue to travel only through explicit return values, never
  `process.env`, never logs, never `--json` output.

#### 11. Adapter seam (`core/types.ts`)

```ts
export interface TrackerAdapter {
  readonly provider: ProviderName;
  resolveRef(ref: string): Promise<ExternalRef>;      // "FIN-123" | URL | "owner/repo#12"
  fetchIssues(ids: string[]): Promise<ExternalIssue[]>;   // batched, canonical values
  applyChanges(id: string, patch: CanonicalPatch): Promise<{ updatedAt: string }>;
  upsertAttachments(id: string, attachments: AttachmentSpec[]): Promise<void>;
  spliceDescription(id: string, block: string): Promise<void>;
  postConflict(id: string, report: ConflictReport): Promise<{ commentId: string }>;
  ensureMeta(force?: boolean): Promise<ProviderMeta>;
}
```

`ExternalIssue` and `CanonicalPatch` use tbd-canonical values (tbd status enum, P0–P4),
so mapping tables live in one place per provider.
The GitHub adapter is a second implementation with a simpler state model (open/closed,
no state UUIDs) plus PR linking.

#### 12. Read-only web projection (`lib/issue-query.ts`, `cli/web/board.ts`, `src/web/`)

The web viewer reads integration state only from the bead snapshot it already owns.
It never queries Linear or GitHub, never changes a link, and never changes the explicit
`tbd sync` contract.
An ordinary `tbd integration link`, `unlink`, or `sync` writes the bead through the
normal locked data path; the existing local observer then publishes the complete new
snapshot over SSE.

The server projects a strict additive value from each valid namespace:

```ts
interface ExternalLinkView {
  provider: 'linear' | 'github';
  id: string;
  key: string | null;
  url: string | null; // only validated http(s), never arbitrary extension content
}
```

`BoardRow` and `BeadBody` carry this allow-list; bridge bases, intents, arbitrary
extension keys, and credentials never cross the loopback API. GitHub PR associations use
a separate `prs` collection because a bead may have one tracker issue link and many
implementation PRs. The row displays one compact Links column with accessible Linear and
GitHub marks and direct external navigation.
A link click does not expand the row.

Filtering is shared semantics, not client-only filtering.
`IssueQuery` and `tbd list` gain `linked=any|linear|github|none`; `parseBoardQuery()`
consumes the same value and `BoardState.buildBoardResponse()` computes conditional facet
counts after every other active filter.
The chooser vocabulary is **All / Linked / Linear / GitHub / Unlinked**. Zero-count
unselected options are hidden, selected options remain removable, and the All button
does not repeat a repository-wide tally already visible in the header.

The CSS design-system inventory is authoritative for logo geometry, muted/hover/focus
colors, dark mode, compact transitions, and fixed table layout.
Inline symbols are defined once and referenced by rows; no icon dependency and no
per-row duplicated SVG paths are required.

### API Changes

Shipped in Phase 1:

- `IssueSchema`: **unchanged**. The link lives in the existing `extensions` namespace,
  so there is no new field and **no `tbd_format` bump**.
- `ConfigSchema`: the optional `integrations` block.
  `ConfigSchema` has no `extensions` escape hatch, so an older CLI rewriting config
  drops this block — **this happened twice during the pilot**, both times restored from
  git history. The loss is recoverable (`config.yml` is tracked) but silent at loss time
  and loud only at use time, so Phase 2’s doctor additions include a tripwire: warn when
  beads carry provider links but no matching integration is configured.
  Releasing Phase 1 closes the gap for this key (it becomes known to the schema); a
  general `ConfigSchema` extensions namespace is tracked separately.
- `FIELD_STRATEGIES`: `extensions` changed from `'lww'` to per-namespace three-way merge
  with absence-as-value.
- Commands: `tbd integration status` and `tbd integration sync --push`, with the bulk
  guard’s `--yes`.
- `tbd doctor`: two non-fatal checks (integrations, parent hierarchy).
- `engines.node`: `>=20` → `>=20.12` (for `util.parseEnv`).

Phase 2 adds:

- `policy` on each provider config: preset name or inline `PolicyDefinitionSchema`;
  Phase 1’s `select` folds into `policy.outbound` as a deprecated alias.
- Commands:
  `tbd integration link <bead> <ref> [--take local|remote] [--force] | unlink <bead...> | sync [--push selectors | --pull [--external <ref...>] [--force]] [--dry-run] [--yes]`.
  All honor the bulk guard in **both directions** (inbound creates and bead updates
  count too), and `--pull` performs no external writes.
- A `lk` bridge-record type on the sync branch with a newest-observation merge rule in
  `file/git.ts`.
- No change to `tbd changes` / `tbd watch` output contracts: sync-originated bead writes
  flow through the normal write path and appear as ordinary field deltas.

Phase 3 plans one provider implementation, not a second integration framework:

- GitHub issues implement the complete `TrackerAdapter` lifecycle and participate in
  policy, link/explicit-inbound/outbound-projection, two-way field sync, comments,
  conflicts, and orphans.
- GitHub pull requests are read-only implementation associations.
  tbd stores and refreshes their identity and display metadata, but never rewrites PR
  title, body, review state, merge state, or branch state.

Phase 4 is additive to both the CLI and web response:

- `tbd list --linked any|linear|github|none` and the corresponding `IssueQuery` field.
- Allow-listed external links on board rows and bead details, plus conditional provider
  facet counts. Existing clients ignore the new response keys.

## Documentation Updates

Docs ship with the phase that makes them true, in the same PR as the code:

**Phase 1:**

- `packages/tbd/docs/tbd-docs.md` — new Integrations section: config block, `.env` rules
  and the no-`process.env` policy, `tbd integration` command reference, outbound
  semantics, selection defaults.
- `packages/tbd/docs/tbd-design.md` — §2.7 schemas (the `extensions.<provider>` link
  payload, `integrations` config, the policy), §3.5 merge rules (per-namespace
  `extensions`, the `lk` bridge-record rule), new §8.7 replacement text for external
  tracker linking (currently a sketch), bridge-state layout under the §2.2 directory
  structure.
- `README.md` — one short paragraph + pointer, mirroring how watch is introduced.
- `.claude/skills/tbd/SKILL.md` and `.agents/skills/tbd/SKILL.md` — the agent-facing
  command list gains `tbd integration status` and `tbd integration sync` with one-line
  usage rules (notably: never echo credentials; run `status` before a write).
- `packages/tbd/CHANGELOG.md` — entry per landed PR.
- `docs/docs-overview.md` — index the new spec and research doc if not already listed.

**Phase 2:** tbd-docs.md policy reference (presets, clauses, the “policy is only a
default” rule) and sync semantics (base, conflicts, the comment contract and its
`commentResolve` lifecycle); a note in the `watch-beads` shortcut that sync-originated
changes appear in watch reports as ordinary field deltas.

**Phase 3:** GitHub provider docs in the same sections; `tbd shortcut setup-github-cli`
cross-reference for the `gh auth token` path.

**Research doc**: `research-2026-08-09-linear-task-surfaces.md` gains a one-line pointer
to this spec as the design of record (already listed in its references).

## Implementation Plan

### Phase 1: Framework, credentials, and one-way mirror — ✅ done (PR #206)

Delivered the epic-overview use case and all the plumbing, with no inbound path and so
no concurrency exposure.
Validated live against the `tbd` Linear project: staged rollout (3 → 13 → 82 beads),
bulk-guard refusal exercised, and a team move (0 creates, 80 updates, all keys refreshed
`FIN-*` → `TBD-*`).

- [x] `lib/env-file.ts` (`util.parseEnv`, no `process.env` mutation) + engines bump;
  gitignore enforcement in status/doctor.
- [x] `integrations/core/credentials.ts` with masking; secret-hygiene tests.
- [x] `IntegrationsConfigSchema`; `integrations/core/registry.ts`.
- [x] `cli/commands/integration.ts` on `BaseCommand`; `status` with probes, remedies,
  exit codes, `--offline`; doctor checks.
- [x] `linear/client.ts` + `linear/queries.ts` (zod-validated, rate-limit aware,
  `LINEAR_API_URL` override); `ensureMeta()` cache; mock server with the API’s real
  quirks.
- [x] Link storage in `extensions.<provider>` (`core/link-store.ts`), allow-list
  enforced by `PERSISTED_LINK_KEYS` test.
- [x] `extensions` per-namespace three-way merge (`tbd-le2l`), absence-as-value.
- [x] `parent_id` cycle and depth validation (`lib/issue-hierarchy.ts`).
- [x] `linear/mapping.ts` pure tables, priority non-bijection, open state-type set.
- [x] `core/selection.ts`, `core/managed-block.ts`, `core/permalink.ts`,
  `core/bulk-guard.ts`.
- [x] `planMirror`/`applyMirror`; `sync --push` with selectors, `--dry-run`, `--yes`,
  `--json`; key/url refresh on update.
- [x] Phase 1 documentation.

Carried into Phase 2 (deliberately, not oversights): `link`/`unlink`/explicit inbound
(`tbd-az29`) because their semantics are the reconcile engine’s (stance on link, base
seeding); and end-to-end tryscript goldens against the mock server (`tbd-uu08`).

### Phase 2: Policy and bidirectional sync — ✅ implemented (PR #206)

Build order matters: each step is testable before the next, and the pure core lands
before anything touches the network.

- [x] **`core/policy.ts`** — `PolicyDefinitionSchema`, `PolicyName` presets,
  `resolvePolicy(config): PolicyDefinition`; fold legacy `select` into
  `policy.outbound`; exhaustive zod round-trip tests.
- [x] **`core/bridge-state.ts`** — `readLinkRecord`/`writeLinkRecord` on
  `bridge/<provider>/links/<bead-id>.yml`; `LinkRecordSchema` (`type: lk`); reverse
  index (`byExternalId`); normalized description hashing.
- [x] **Bridge merge rule in `file/git.ts`** — `lk` records merge by newest observation
  (`remote_updated_at`, `synced_at` tie-break); multi-machine merge test with a
  constructed divergent history.
- [x] **`core/reconcile.ts`** — the pure field matrix:
  `reconcile(base, local, remote, rules) → {beadPatch, externalPatch, conflicts}`;
  property tests over the full changed/unchanged × owner matrix; description
  normalization (managed-block strip, line endings).
- [x] **`core/intents.ts`** — intent file per run under `bridge/<p>/intents/`; replay on
  start (cross-machine safe); idempotency table backed by mock-server tests (duplicate
  create, re-update, attachment upsert, comment dedup probe).
- [x] **`adapter.postConflict()` + `queries.ts` additions** — `commentCreate` (client
  UUID), `commentResolve`/`commentUnresolve`, archived/deleted detection for orphans,
  `updatedAt`-filtered batched fetch.
- [x] **`tbd integration sync`** — replay → pull (derived watermark, generous overlap) →
  reconcile → apply (external, then beads via the normal write path, then base advance +
  intent cleanup, committed) → policy scan (create outbound-new, create inbound or
  report inbound per mode) → honest report.
  `--dry-run`, `--yes` (guard in both directions), `--json`.
- [x] **Comment sequences** — union-by-id merge for the `comments` array inside a
  provider namespace; pull/push inside `sync` per `field_sync.comments`;
  `tbd integration comment <bead> "text"`; body/count caps with stub collapse; replay
  dedup per open question 7.
- [x] **Link / unlink / explicit inbound selection** (`tbd-az29`, hardened by `tbd-pr5e`
  and `tbd-utuy`) — link stance (`--take`, interactive diff, non-interactive refusal);
  one-source guard via reverse index, all local bead links, and a `tbd://bead/`
  attachment probe (`--force` override); `sync --pull --external` as one-shot all-remote
  creation; unlink clears bead + bridge.
- [x] **`status` additions** — linked / pending-outbound / importable / drifted /
  conflicted / orphaned counts; unresolved conflict comments; `--offline` degrades to
  base-vs-local drift only.
- [x] **Fold into `tbd sync`** behind `sync_on_tbd_sync` (default true once a provider
  is explicitly enabled): runs after git pull/merge and before push; degraded external
  state never blocks or corrupts git sync.
  The pilot explicitly sets it false until the live rollout gates pass.
- [x] **End-to-end coverage against the mock server** (`tbd-uu08`) — delivered as a
  vitest suite spawning the REAL built binary in a real repository (status, push,
  sync-settle, tracker-edit pull, comment round-trip, one-source refusal, `--take`
  refusal, credential remedy), which covers what the tryscript goldens were for with
  simpler server lifecycle; a tryscript variant can still layer on later.
- [x] Phase 2 documentation.

### Phase 3: GitHub adapter

- [ ] **`tbd-lmo9`: transport and adapter.** Native REST client, zod response schemas,
  canonical mapping, repository target validation, `GITHUB_TOKEN` then `gh auth token`,
  status probes, pagination, rate-limit and permission remedies.
- [ ] **`tbd-tnks`: GitHub issue lifecycle.** Prove the existing provider-generic
  link/explicit-inbound/push/sync/comment/unlink paths without Linear-specific branches.
- [ ] **`tbd-v75l`: PR associations.** Store `extensions.github.prs`, expose explicit
  link/unlink/list verbs, refresh read-only metadata, and upsert native GitHub PR/issue
  attachments on Linear.
  PR content and lifecycle are never tbd-owned fields.
- [ ] **`tbd-v1u1`: mock plus live release gate.** Real built-CLI E2E and a bounded
  disposable issue/PR pilot, including cross-clone convergence and cleanup.
- [ ] **`tbd-xbkm`: Phase 3 documentation and installed skills.**

### Phase 4: External integrations in `tbd web`

- [ ] **`tbd-qsda`: shared query/facet semantics.** Add `IssueQuery.linked`, CLI
  `--linked`, the web External chooser, and conditional counts.
- [ ] **`tbd-6yxi`: safe server projection.** Add allow-listed link values to
  `BoardRow`/`BeadBody`; prove malformed or secret-bearing extensions cannot leak.
- [ ] **`tbd-6k5g`: presentation.** Accessible Linear/GitHub link marks, direct
  navigation, stable table geometry, dark mode, and bounded DOM behavior.
- [ ] **`tbd-35mn`: design, docs, installed-skill, and package proofs.** Preserve the
  read-only/no-remote web contract and the agent-owned mutation workflow.

## Testing Strategy

Phase 1 shipped with 161 new vitest cases (1,612 total across 109 files) plus the mock
Linear server (`tests/helpers/linear-mock-server.ts`) reproducing the API’s real quirks:
200-with-errors, 400 `RATELIMITED`, duplicate-id rejection, attachment upsert.
Phase 2 extends the same structure:

- **Unit, pure core first**: `policy.test.ts` (preset expansion, `select` folding,
  round-trip); `reconcile.test.ts` (**the full matrix**: {unchanged, changed-same,
  changed-different}² × {merge, local, remote} per field, plus description
  normalization); `bridge-state.test.ts` (record round-trip, reverse index, hashing).
- **Merge**: multi-machine bridge divergence — two histories advancing the same link
  record, merged, newest observation wins; namespace-deletion non-resurrection already
  covered in Phase 1’s `merge-namespaces.test.ts`.
- **Crash replay**: `intents.test.ts` simulates a crash after every step of the apply
  sequence and asserts the next run converges without duplicates — the mock server’s
  duplicate-id and upsert behavior is what makes this provable.
  The engine test also crashes immediately after a user comment lands but before its
  local entry is marked, then proves replay records the original UUID, plans no second
  push, consumes the intent, and leaves the following run quiet.
- **Comments**: two machines append different comments and merge (union, both survive);
  the same comment pulled twice dedupes; a capped thread collapses to stubs without
  losing ids.
- **Echo**: push, then pull with a bumped `updatedAt` and identical fields → zero
  changes reported. This pins the “correctness never depends on timestamps” property.
- **Guards, both directions**: >20 imports and >40 inbound bead updates refuse
  non-interactively without `--yes`, same as outbound.
- **Secret and data hygiene**: no credential substring in any output or error path
  (Phase 1, extended to new commands); bridge records contain **only** the `lk` schema
  keys; imported beads contain only canonical fields (assert the absence of assignee,
  emails, and unknown keys).
- **Built-CLI lifecycle against the mock server** (`tbd-uu08`): status → push → re-push
  no-op → link stance refusal → sync pull/push → forced both-sides conflict (attic +
  comment) → orphan report → rate-limit backoff → degraded run.
- **Offline/unconfigured**: every subcommand and doctor behave correctly with no
  credential and no network.
- **Manual QA playbook** (`tests/qa/`): full loop against the pilot Linear project,
  including two machines running sync concurrently with no echo or ping-pong, and a
  deliberate both-sides conflict resolved through the comment lifecycle.
- **Integrity gates added after the live pilot finding**: corrupt pre-existing data with
  two beads linked to one external id must fail closed before any external write, name
  every holder, and allow unrelated pairs to continue.
  Every prefix accepted by setup must resolve through the real binary.
- **Web integration projection**: pure query/facet tests, server allow-list tests,
  client accessibility/DOM tests, SSE link/unlink refresh, fixed-column CSS assertions,
  and extracted-package validation.
  Tests must prove the page makes no provider request.
- **GitHub**: a faithful REST mock pins response/error/rate-limit behavior, followed by
  the same real-binary convergence suite as Linear and one bounded live pilot.

## Rollout Plan

1. ✅ Phase 1 landed with **no format bump** (links ride `extensions`) and the engines
   bump. No behavior change for repositories without an `integrations` block.
2. ✅ This repo is the pilot: 84 issues mirrored into the `tbd` project on the `TBD`
   team, through a staged rollout and a team move.
   Ongoing: keep mirroring as the epic set evolves.
3. Phase 2 implementation and the bounded live pilot are complete.
   Before this pilot removes its explicit `sync_on_tbd_sync: false` override and PR #206
   receives its final Linear RC disposition:
   - ✅ the reconcile matrix, crash replay, real-binary lifecycle, and upstream v0.5.0
     semantic-merge tests are green;
   - close the integrity beads in the [post-v0.5 execution map](#post-v05-execution-map)
     after the complete local suite passes;
   - ✅ `tbd-40el` live evidence: forced conflict/archive recovery, inbound and outbound
     comments, quiet archive/orphan detection, and alternating two-clone sync all
     converged without echo or ping-pong;
   - ~~`tbd-rdsb` resolved~~ **done**: root-caused as tryscript cross-contamination
     through a shared origin repo, not a product bug; fixed with per-file origins;
   - failure-injection coverage for transport errors mid-run.
     `inbound.mode: auto` stays off by default even then — it lets people outside the
     repo create work inside it, and a repo should opt into that knowingly.
4. Phase 3 adds GitHub issues first, then read-only PR associations.
   It cannot ship until its mock, real-binary, cross-clone, permission, and bounded
   live-pilot gates pass.
5. Phase 4 may ship for Linear independently; its provider-generic response and filter
   contract must accept GitHub links without another browser architecture change.

## Relationship to PR #197

PR #197 conflates the watch foundation (since superseded by PR #205) with the Linear
pilot. **It should be closed once this spec is approved**, with its design contribution
recorded here.

**Adopted from #197:** the `linked` field shape and UUID-canonical keying; the
single-source-per-bead invariant and its collapse rule; bridge state on the sync branch
with a `base` tuple for true three-way merge; echo suppression by recording post-write
`updatedAt`; the provider-generic command group with ref inference; the `TrackerAdapter`
seam; the `extensions` merge fix as a prerequisite; failure containment; orphan
semantics; the mock-server golden-test approach; and raw `fetch` over `@linear/sdk`.

**Changed or added here:**

- Sequenced **mirror first, sync second**. #197 begins with bidirectional single-bead
  sync; the mirror delivers the main use case with none of the risk.
- **Full bead embedding via attachment upsert and a managed description block**, enabled
  by the `attachmentCreate` upsert behavior verified for this spec.
- **Conflict comments on the external item** with a `commentResolve` lifecycle.
  #197 archived losers locally only, leaving no signal where the human is looking.
- **`.env` loading (without touching `process.env`), `tbd integration status`, and
  doctor checks.** Absent from #197; the `process.env` constraint comes from
  `buildGitEnv()` spreading the environment into git subprocesses and their hooks.
- **Epic selection and spec permalinks**, including the branch-locality problem.
- **Nested epic support** with a mirror depth cap and the `parent_id` cycle guard.
- **Write-ahead intents.** #197 relies on the data-sync lock without addressing
  partial-failure replay across two systems.
- **Corrections**: rate limit is 2,500 not 5,000; `RATELIMITED` arrives on HTTP 400;
  `WorkflowState.type` is an open string set including `duplicate`; page size caps at
  250; `issueCreate` is not idempotent; and the priority map is deliberately not
  bijective because Linear `0` means unset.
- **Command naming**: the `integration` group plus the shared `sync --push/--pull`
  directional vocabulary, replacing both `bridge` and the draft `mirror`/`import` verbs.
- **GitHub scoped to include PR linking**, with `extensions.github` as the bead-side
  home for PR URLs.

## Open Questions

1. **Does `issueBatchCreate` accept client-generated ids, and does one duplicate fail
   the whole transaction?** Not probed.
   The current engine intentionally uses individually journaled creates, so this is a
   future performance question rather than a correctness dependency.
2. **Label groups for mirrored facets?** Single-select and groupable, so a
   `tbd:status/*` group is cleaner than flat labels, at the cost of creating group
   objects in the workspace.
   Decide during the pilot by looking at the actual board.
3. **Is the observed 2,500 requests/hour a free-plan restriction** or a documentation
   error? Re-probe on a paid workspace; the client reads headers either way.
4. **Should `tbd web` render integration state** (linked, drift, unresolved conflicts)?
   Likely yes, but it belongs to that spec.
5. **Linear “Loops”** appears in Linear’s changelog for recurring scheduled agent work
   but has no type in the introspected schema.
   Verify before designing against it.
6. **Named policies beyond `default`**: which presets earn names first (`triage-only`?
   `full-sync`? `inbound-heavy`?), and whether user-defined named policies belong in
   config (`integrations.policies.<name>`) or stay inline.
   Decide after the default has run on the pilot for a while.
7. ~~Does `commentCreate` honor a client-generated UUID?~~ **Answered live (2026-08-10):
   yes.** The created comment’s id IS the client id; a duplicate is rejected with
   `INPUT_ERROR` “already exists” — arriving on HTTP **200** with an errors array,
   unlike `issueCreate`’s 400 — and exactly one comment results.
   Conflict-comment replay is therefore exactly-once, and the mock encodes this
   verbatim.

## References

- [research-2026-08-09-linear-task-surfaces.md](../../research/current/research-2026-08-09-linear-task-surfaces.md)
- [plan-2026-08-10-tbd-web-live-bead-view.md](plan-2026-08-10-tbd-web-live-bead-view.md)
- [plan-2026-07-19-bead-watch-and-external-sync.md](plan-2026-07-19-bead-watch-and-external-sync.md)
- PR [#205](https://github.com/jlevy/tbd/pull/205), PR
  [#197](https://github.com/jlevy/tbd/pull/197)
- [Linear GraphQL API](https://linear.app/developers/graphql) ·
  [rate limiting](https://linear.app/developers/rate-limiting) ·
  [webhooks](https://linear.app/developers/webhooks) ·
  [agents](https://linear.app/developers/agents)
- Node [`util.parseEnv`](https://nodejs.org/api/util.html#utilparseenvcontent)
