---
title: External Tracker Integrations
description: A provider-generic integration layer for syncing beads with external trackers, with Linear as the first provider and GitHub issues and PRs next
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: External Tracker Integrations (Linear first, GitHub next)

**Date:** 2026-08-10 (last updated 2026-08-10)

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Draft

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
- [plan-2026-08-10-tbd-web-live-bead-view.md](plan-2026-08-10-tbd-web-live-bead-view.md)
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
- **Nothing changes for repositories that do not enable an integration.**

## Non-Goals

- **No daemon and no webhooks.** Linear webhooks need a public HTTPS endpoint answering
  within 5 seconds, which a CLI cannot offer.
  Polling is also the mandatory reconciliation path regardless, because Linear retries a
  failed webhook only 3 times before auto-disabling it.
- **No Linear Agents / `AgentSession` integration.** It needs a hosted OAuth `actor=app`
  backend. It remains the eventual target for delegation and is out of scope here.
- **No mirroring of the whole bead store.** Only epics and explicitly linked beads
  participate. The value is the filter.
- **No comment or notes synchronization** beyond the conflict-report comments defined
  here.
- **No multi-repo to one tracker support.** Two repos linking the same external item
  would double-write. Documented as unsupported and detected where cheap.
- **No generated `TODO.md`** in this spec.
  Deferred deliberately: the format is unsettled, and a second generated to-do surface
  risks agents disagreeing about which list is authoritative.

## Background

**Current state, verified 2026-08-10:**

- tbd has **no external tracker support**: no link field, no provider code, no
  integration config.
- tbd has **no `.env` loading**. The only environment variables read are `TBD_DEBUG`,
  `TBD_DEV_VERSION`, `NO_COLOR`, `PAGER`, and the `GIT_*` pass-throughs.
- **Git subprocesses inherit the full environment**: `buildGitEnv()`
  (`packages/tbd/src/lib/git-env.ts`) spreads `...process.env` into every spawned git
  process, and git in turn runs user hooks.
  This constrains the credential design: a secret loaded into `process.env` would leak
  into every git hook.
  See
  [Component 1](#1-credentials-and-env-srclibenv-filets-srcintegrationscorecredentialsts).
- `BaseEntity.extensions` exists as a third-party namespace, but its merge strategy is
  **whole-object LWW** (`extensions: 'lww'` in `FIELD_STRATEGIES`,
  `packages/tbd/src/file/git.ts`). Two writers touching different namespaces would
  silently drop one side.
  This is bead `tbd-le2l`.
- Issue parsing uses Zod strip mode, so **unknown frontmatter fields are discarded on
  write** by an older CLI. Any new synced field needs a format gate.
- `mergeIssues(base, local, remote)` (`packages/tbd/src/file/git.ts`) is already a real
  three-way merge against git’s merge base.
  LWW applies only as the tie-break when both sides changed the same field, with the
  loser preserved in `attic/`.
- There is **no cycle or depth validation on `parent_id`**.
- CLI commands follow the `BaseCommand` pattern
  (`packages/tbd/src/cli/lib/base-command.ts`): a handler class with `run()`, `this.ctx`
  for global flags, `this.output.data(json, textFn)` for dual output, `CLIError` +
  shared exit codes from `cli/lib/exit-codes.ts`.
- This repo has **1,312 beads, 217 active, 21 active epics, 14 of those carrying a
  `spec_path`** — the mirror set is roughly two dozen items.

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

## Design

### Approach

Three layers, each independently useful:

1. **Integration framework** — config, credentials, `.env` loading, status and doctor
   checks, and the `TrackerAdapter` seam.
   Provider-agnostic.
2. **Mirror (one-way, tbd to tracker)** — the selection set is projected outward.
   Nothing is imported.
   This needs none of the concurrency machinery below and is safe to run from any agent.
3. **Sync (bidirectional, opt-in per link)** — three-way merge against a recorded base,
   with conflict comments.

### Naming

The command group is **`tbd integration`** and the config key is `integrations`. PR #197
used `bridge`; `integration` matches how this capability is described everywhere else in
the project and reads better for GitHub, where “bridge” implies more symmetry than PR
linking actually has.
The one-way projection command is **`mirror`** (a verb with the right one-way
connotation; “project” collides with Linear’s Project noun).

### Module layout

```
packages/tbd/src/
├── lib/
│   └── env-file.ts                    # .env discovery + util.parseEnv wrapper
├── integrations/
│   ├── core/
│   │   ├── types.ts                   # TrackerAdapter, ExternalIssue, CanonicalPatch,
│   │   │                              #   ProviderMeta, ConflictReport, MirrorPlan
│   │   ├── credentials.ts             # resolveCredential(), maskSecret()
│   │   ├── registry.ts                # providerFor(ref|name), configured()
│   │   ├── selection.ts               # mirrorSet(issues, config): Issue[]
│   │   ├── managed-block.ts           # renderManagedBlock(), spliceManagedBlock()
│   │   ├── permalink.ts               # specPermalink(spec_path, bead): URL
│   │   ├── bridge-state.ts            # read/write .tbd/data-sync/bridge/<provider>/
│   │   ├── three-way.ts               # diffAgainstBase(), mergeFieldwise()
│   │   └── intents.ts                 # write-ahead intent journal + replay
│   ├── linear/
│   │   ├── client.ts                  # gql(), rate-limit handling, pagination
│   │   ├── adapter.ts                 # LinearAdapter implements TrackerAdapter
│   │   ├── mapping.ts                 # status/priority/label tables (pure)
│   │   └── queries.ts                 # query/mutation strings + zod response schemas
│   └── github/                        # Phase 3, same shape as linear/
└── cli/commands/
    └── integration.ts                 # command group: status|link|unlink|import|mirror|sync
```

Dependency direction: `cli/commands/integration.ts` → `integrations/core` → provider
modules. Nothing in `file/` or `lib/` imports from `integrations/`; the `linked` field
schema and merge rule live in the existing `lib/schemas.ts` and `file/git.ts` because
they are part of the entity model, not the integration.

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
| links | count from `bridge/<p>/state.yml`; drift = links whose base differs from current bead |

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
- **“At most one link per provider” is structural**, not enforced: the namespace key
  *is* the provider, so there is no second entry to collapse and no merge rule needed.
  A bead can hold a Linear link and a GitHub link at once, each merged independently.
- `LinkedEntry` remains in `lib/schemas.ts` as the payload shape, validated on read out
  of the namespace rather than as a schema field.
  A malformed namespace reads as unlinked rather than throwing, so a hand-edited bead
  cannot break a mirror run.
- The per-namespace `extensions` merge (`tbd-le2l`) is a **prerequisite**: whole-object
  LWW would drop a real link when two writers touch different namespaces.
- `last_actor` is deferred to Phase 2, where echo suppression actually needs it.
  It will live at `extensions.tbd.last_actor` for the same reason.

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

#### 6. Selection (`core/selection.ts`) and config (`lib/schemas.ts`)

```yaml
integrations:
  sync_on_tbd_sync: false
  linear:
    enabled: true
    team_key: FIN
    select:
      kinds: [epic]          # default: epics
      statuses: [open, in_progress, blocked]
      labels: []             # optional additional selectors
      linked: true           # always include explicitly linked beads
    create_labels: true
    max_nesting: 2           # levels of sub-epic mirrored
    user_map: {}
  # github:
  #   enabled: true
  #   repo: owner/name
```

`IntegrationsConfigSchema` in `lib/schemas.ts`, optional on `ConfigSchema` so existing
configs are untouched.
`mirrorSet()` reuses the predicates in `lib/issue-selection.ts` (the same module
`list`/`ready`/`changes` share) — the mirror must not grow its own filter semantics.

**Nested epics** are supported in tbd but mirrored at most `max_nesting` levels deep,
because Linear’s data model nests arbitrarily while its *views* flatten past about two
levels. Deeper structure stays in beads where `tbd dep` and `tbd web` render it.
This requires the `parent_id` cycle/depth guard (Phase 1) so a cycle cannot hang the
mirror.

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

#### 9. Mirror (`cli/commands/integration.ts` → adapter)

```
tbd integration mirror [--provider <p>] [--dry-run] [--json]
```

Plan/apply split so `--dry-run` is the same code path minus writes:

```ts
export function planMirror(beads: Issue[], state: BridgeState, meta: ProviderMeta):
  MirrorPlan;   // pure: creates, updates, attachment upserts, block splices, skips
export async function applyMirror(plan: MirrorPlan, adapter: TrackerAdapter):
  Promise<MirrorReport>;
```

Ordering per bead: upsert issue (create with client UUID, treating the duplicate-id
error as success; then `issueUpdate`) → upsert attachments → splice managed block →
record external id into `linked` (if not present) and bridge state.
Parents mirror before children so `parentId` can be set.
Re-running with no changes is a no-op (verified by golden test).

Cost envelope: ~21 epics × ~4 calls ≈ 100 requests, far under 2,500/hour.

#### 10. Sync (`core/bridge-state.ts`, `core/three-way.ts`, `core/intents.ts`)

Bridge state on the `tbd-sync` branch, one directory per provider:

```
.tbd/data-sync/bridge/linear/
├── state.yml        # per-link: external id, updatedAt at last sync, base tuple
├── intents.yml      # write-ahead journal; empty in the steady state
└── meta.yml         # cached states-by-type + labels
```

- The `base` tuple per link makes sync a true three-way merge (`three-way.ts` reuses the
  shape of `mergeIssues`): local diff = bead vs base; remote diff = mapped issue vs
  base; one-sided changes merge silently.
- **Concurrency**: sync runs under the existing repo-scoped data-sync lock — the same
  opportunistic-single-writer model `tbd sync` already has.
  Before any external write, the run appends intents (with client-generated UUIDs) to
  `intents.yml` and commits; on restart, unfinished intents replay.
  Attachment writes are idempotent by design; `issueCreate` replays treat duplicate-id
  as success; `issueUpdate` replays are followed by a base refresh so they cannot echo.
- **Echo suppression**: after a push, record Linear’s post-write `updatedAt` and refresh
  `base`; the next pull sees no remote diff for tbd’s own write.
  No actor filtering needed; works with a plain API key.
- **Conflicts** (both sides changed the same field): resolve by configured per-field
  owner, else LWW; archive the loser to the attic (existing machinery); **and post a
  comment** via `postConflict()` naming the field, both values, and the attic path.
  `commentResolve` gives the report a native handled/unhandled state an agent can query.
- **Failure containment**: external errors mark the run degraded, reported per link; git
  phases still complete; external failure never blocks or corrupts git sync.
- Orphans: archived/deleted external item → link marked `orphaned`, warn, never
  auto-delete a bead; deleted bead → external item untouched, reported.

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

### API Changes

- `IssueSchema`: **unchanged**. The link lives in the existing `extensions` namespace,
  so there is no new field and **no `tbd_format` bump**.
- `ConfigSchema`: add the optional `integrations` block.
  `ConfigSchema` has no `extensions` escape hatch, so `tbd setup` on an older CLI drops
  this block. That loss is recoverable (`config.yml` is tracked) and loud (the mirror
  stops working), unlike the silent bead-field loss, so it does not justify a format
  bump on its own. Giving `ConfigSchema` its own extensions namespace is tracked
  separately.
- `FIELD_STRATEGIES`: `extensions` changed from `'lww'` to per-namespace merge.
  This is now a **prerequisite** rather than a cleanup: whole-object LWW would drop a
  real link.
- New command group: `tbd integration status | link | unlink | import | mirror | sync`.
  (`import <ref>` creates a linked bead from an external item; it is explicitly
  user-invoked, not part of `mirror`.)
- `tbd doctor`: new non-fatal Integrations check.
- `engines.node`: `>=20` → `>=20.12` (for `util.parseEnv`).
- No change to `tbd changes` / `tbd watch` output contracts beyond the new fields
  appearing in field deltas.

## Documentation Updates

Docs ship with the phase that makes them true, in the same PR as the code:

**Phase 1:**

- `packages/tbd/docs/tbd-docs.md` — new Integrations section: config block, `.env` rules
  and the no-`process.env` policy, `tbd integration` command reference, mirror
  semantics, selection defaults.
- `packages/tbd/docs/tbd-design.md` — §2.7 schemas (`linked`, `last_actor`,
  `integrations` config), §3.5 merge rules (new strategies, `extensions` change), new
  §8.7 replacement text for external tracker linking (currently a sketch), bridge-state
  layout under the §2.2 directory structure.
- `README.md` — one short paragraph + pointer, mirroring how watch is introduced.
- `.claude/skills/tbd/SKILL.md` and `.agents/skills/tbd/SKILL.md` — the agent-facing
  command list gains `tbd integration status|mirror` with one-line usage rules (notably:
  never echo credentials; run `status` before `mirror`).
- `packages/tbd/CHANGELOG.md` — entry per landed PR.
- `docs/docs-overview.md` — index the new spec and research doc if not already listed.

**Phase 2:** tbd-docs.md sync semantics (base, conflicts, the comment contract and its
`commentResolve` lifecycle); a `watch-integrations` note in the `watch-beads` shortcut
explaining how sync-originated changes appear in watch reports (`last_actor`).

**Phase 3:** GitHub provider docs in the same sections; `tbd shortcut setup-github-cli`
cross-reference for the `gh auth token` path.

**Research doc**: `research-2026-08-09-linear-task-surfaces.md` gains a one-line pointer
to this spec as the design of record (already listed in its references).

## Implementation Plan

### Phase 1: Framework, credentials, and one-way mirror

Delivers the epic-overview use case and all the plumbing, with no import path and so no
concurrency exposure.

- [ ] `lib/env-file.ts` (`util.parseEnv`, no `process.env` mutation) + engines bump;
  gitignore enforcement in status/doctor/setup.
- [ ] `integrations/core/credentials.ts` with masking; secret-hygiene tests.
- [ ] `IntegrationsConfigSchema`; `integrations/core/registry.ts`.
- [ ] `cli/commands/integration.ts` scaffold on `BaseCommand`; `status` with probes,
  remedies, exit codes; doctor `safeCheck('Integrations', …)`.
- [ ] `linear/client.ts` + `linear/queries.ts` (zod-validated, rate-limit aware,
  `LINEAR_API_URL` override); `ensureMeta()` cache.
- [ ] Link storage in `extensions.<provider>` via a read/write/clear module.
  No schema change, no format gate; `tbd show` renders it for free through `extensions`.
- [ ] `extensions` per-namespace merge fix (`tbd-le2l`) with attic on namespace loss.
- [ ] `parent_id` cycle and depth validation.
- [ ] `linear/mapping.ts` pure tables with exhaustive tests, including the deliberate
  priority non-bijection and open state-type set.
- [ ] `core/selection.ts` on `lib/issue-selection.ts`; `core/managed-block.ts`;
  `core/permalink.ts`.
- [ ] `planMirror`/`applyMirror`; `tbd integration mirror` with `--dry-run`/`--json`;
  duplicate-id-as-success; parents before children; no-op idempotency golden test.
- [ ] `tbd integration link / unlink / import <ref>` with the one-source guard.
- [ ] Phase 1 documentation (list above).

### Phase 2: Bidirectional sync on linked beads

- [ ] `core/bridge-state.ts` (state.yml, meta.yml) and `core/three-way.ts`.
- [ ] `core/intents.ts`: write-ahead journal, replay on start, idempotent application.
- [ ] Conflict handling: attic entry + `postConflict()` comment; `commentResolve`
  tracked in bridge state.
- [ ] Batched pull filtered on `updatedAt`; push scan; echo suppression; orphan
  detection.
- [ ] Optional fold into `tbd sync` behind `sync_on_tbd_sync`, default off.
- [ ] Phase 2 documentation.

### Phase 3: GitHub adapter

- [ ] `github/client.ts` (REST over fetch), `github/adapter.ts`, `github/mapping.ts`
  (binary state model); credential via `GITHUB_TOKEN` then `gh auth token`.
- [ ] PR links: `extensions.github.prs` on beads → `attachmentLinkGitHubPR` on mirrored
  Linear items, so an epic shows its implementing PRs.
- [ ] Phase 3 documentation.

## Testing Strategy

- **Unit** (`packages/tbd/tests/`): `env-file.test.ts` (parse via fixtures, precedence,
  no-`process.env` invariant); `credentials.test.ts` (masking, source order);
  `mapping.test.ts` (exhaustive over both enums, non-bijection cases, unknown state
  type); `managed-block.test.ts` (splice preserves prose, malformed markers skip);
  `permalink.test.ts`; `three-way.test.ts`; `intents.test.ts` (replay after simulated
  crash at each step); `selection.test.ts`; cycle/depth guard tests.
- **Golden tryscript against a mock GraphQL server** (`tests/fixtures/linear-mock.ts`,
  an `http.createServer` returning canned responses; `LINEAR_API_URL` override): status
  unconfigured → configured → valid; mirror; re-mirror no-op; link guard; duplicate-id
  create; attachment upsert non-duplication; sync pull/push; both-sides conflict
  producing attic entry + comment; rate-limit backoff; degraded-run reporting.
- **Secret hygiene**: assert no credential substring appears in any command’s stdout,
  stderr, `--json` output, bridge state, or thrown error text — including on failure
  paths.
- **Offline/unconfigured**: every `integration` subcommand and doctor behave correctly
  with no credential and no network.
- **Manual QA playbook** (`tests/qa/`): full loop against a disposable Linear team,
  including two agents running mirror/sync concurrently with no echo or ping-pong.

## Rollout Plan

1. Phase 1 lands with the `tbd_format` bump for the new fields and the engines bump.
   No behavior change for repositories without an `integrations` block.
2. This repo becomes the pilot: mirror its ~21 active epics into a sandbox Linear team,
   confirm the overview is genuinely useful, then point it at the real team.
3. Phase 2 stays opt-in per link and `sync_on_tbd_sync` defaults off until conflict
   handling has been exercised deliberately, including a forced both-sides conflict.
4. Phase 3 after Linear has run for real.

## Relationship to PR #197

PR #197 conflates the watch foundation (since superseded by PR #205) with the Linear
pilot. **It should be closed once this spec is approved**, with its design contribution
recorded here.

**Adopted from #197:** the `linked` field shape and UUID-canonical keying; the
single-source-per-bead invariant and its collapse rule; bridge state on the sync branch
with a `base` tuple for true three-way merge; echo suppression by recording post-write
`updatedAt`; the provider-generic command group with ref inference; the `TrackerAdapter`
seam; the `extensions` merge fix as a prerequisite; `last_actor`; failure containment;
orphan semantics; the mock-server golden-test approach; and raw `fetch` over
`@linear/sdk`.

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
- **Command naming**: `integration` group and `mirror` verb, replacing `bridge`.
- **GitHub scoped to include PR linking**, with `extensions.github` as the bead-side
  home for PR URLs.

## Open Questions

1. **Does `issueBatchCreate` accept client-generated ids, and does one duplicate fail
   the whole transaction?** Not probed; affects bulk import retry safety.
   (The mirror uses per-issue creates, so this only matters for `import --team` bulk
   mode.)
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
6. **`TBD_ACTOR` conventions**: what value agents should set (agent name?
   session id?) is a small cross-cutting decision shared with the watch docs.

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
