# Feature: Shared Common-Dir Sync Worktree

**Date:** 2026-05-17

**Author:** Codex with Joshua Levy

**Status:** Implemented; post-review hardening in progress (see Post-Review Hardening
(PR #121 Follow-up))

## Overview

`tbd` currently stores its hidden `tbd-sync` checkout under each working tree at
`.tbd/data-sync-worktree/`. That works for a single checkout, but it breaks down when
tools like Codex alternate between the user’s main checkout and new Git worktrees
created for agent sessions.
The immediate pain point is simple: Codex should be able to create and sync beads from
either location without Git reporting that `tbd-sync` is already used by another
worktree, and without losing or stranding bead data.

This spec explores Design B: move the local sync machinery out of each checkout and into
the repository’s Git common directory, then serialize access with the existing
mkdir-based lock pattern.
Every linked worktree of the same repository would use one shared local sync worktree.

## Implementation Result

Implemented in branch `codex/implement-shared-common-dir-sync-worktree`.

- `.tbd/config.yml` now migrates to `tbd_format: f04` with
  `sync.storage: git-common-dir-v1`.
- `$GIT_COMMON_DIR/tbd/layout.yml` uses the same `f04` format ID so the checkout config
  and Git common-dir local layout advance together.
- The canonical issue data path is now
  `$GIT_COMMON_DIR/tbd/data-sync-worktree/.tbd/data-sync/`.
- Mutating commands and sync prepare the shared worktree under the repo-scoped
  `$GIT_COMMON_DIR/tbd/locks/data-sync.lock` lock.
- Legacy per-checkout `.tbd/data-sync-worktree/` locations are preserved and removed
  before the shared attached worktree claims `tbd-sync`.
- `doctor`, `status`, setup, init, sync, and uninstall now understand the shared layout.
- Linked-worktree regression coverage verifies that main and agent worktrees resolve to
  the same shared sync worktree.
- Golden CLI scenario coverage now walks the old per-checkout branch-ownership failure,
  f03-to-f04 migration, main-checkout writes, linked-worktree writes, and the f03
  old-client compatibility guard.
- Future-format errors now explicitly state that the repository requires a newer version
  of tbd and include the supported format plus upgrade command.

Validated with:

- `pnpm --filter get-tbd typecheck`
- `pnpm lint:check`
- `pnpm format:check`
- `pnpm --filter get-tbd build`
- `pnpm --filter get-tbd test`
- `pnpm --filter get-tbd test:tryscript`

## Goals

- Make `tbd create`, `tbd update`, and `tbd sync` work seamlessly whether Codex is
  running in the main checkout or a Codex-created sibling worktree.
- Avoid Git’s “branch already used by worktree” failure for `tbd-sync`.
- Keep issue data repo-scoped, not checkout-scoped, so sibling worktrees observe one
  consistent local tbd state.
- Reuse the existing `withLockfile()` mkdir-based mutual exclusion model where it fits.
- Define a migration path from legacy per-checkout `.tbd/data-sync-worktree/` locations
  without silently dropping unsynced data.
- Prevent older `tbd` clients from continuing to write legacy per-checkout sync
  worktrees after a repository has been upgraded to the shared layout.
- Keep `.tbd/config.yml`, installed docs, and committed outbox/workspace state in the
  checkout where they already live.

## Non-Goals

- Supporting mixed old/new `tbd` versions as a long-term operating mode.
  Migration should be safe, but once migrated, all checkouts should use the new version.
- Sharing one physical checkout for user code.
  Only tbd’s local sync machinery moves to the Git common directory.
- Replacing remote Git sync semantics.
  `tbd-sync` remains the branch used to exchange issue data through the repository
  remote.
- Designing a new database or daemon.
  This remains file- and Git-based.

## Problem Scope

### The User Workflow That Must Work

The common workflow is:

1. The user has a normal repository checkout on `main`.
2. The user runs Codex in that checkout for some tasks.
3. Codex sometimes creates a separate Git worktree for a branch and runs there instead.
4. Both locations run commands such as `tbd create`, `tbd update`, `tbd ready`, and
   `tbd sync`.

From the user’s perspective, these are the same repository and should share the same
beads. The fact that one command runs from the main checkout and another runs from a
linked worktree should not matter.

### Current Failure Mode

The current per-checkout hidden worktree model creates:

```text
<checkout-a>/.tbd/data-sync-worktree/
<checkout-b>/.tbd/data-sync-worktree/
```

Both worktrees want to use `refs/heads/tbd-sync`. If either hidden worktree is attached
to `tbd-sync`, Git enforces the one-branch, one-worktree rule and the second one fails
with:

```text
fatal: 'tbd-sync' is already used by worktree at ...
```

### Additional Issues To Avoid

- **Split local state:** Per-checkout data paths let the main checkout and Codex
  worktree drift until sync catches up.
- **Dirty-state races:** Detached per-checkout worktrees avoid branch ownership, but
  they introduce subtle local dirty state and compare-and-swap update ordering problems.
- **Legacy unsynced data:** Existing `.tbd/data-sync-worktree/` directories may contain
  dirty files or commits ahead of remote.
  A new location must not ignore those silently.
- **Unknown “main checkout”:** In Codex or cloud agent environments, we should not
  assume we can find or safely mutate a primary working directory.
  The stable anchor is Git’s common directory, not the user’s main checkout path.

## Background

Git linked worktrees share a common Git directory.
From any linked worktree, `git rev-parse --git-common-dir` points to the repository’s
shared Git storage. That common directory is where Git keeps shared refs and
repository-wide data, while each linked worktree has its own private administrative
directory under `$GIT_COMMON_DIR/worktrees/`.

This suggests a better anchor for local tbd sync machinery:

```text
$GIT_COMMON_DIR/tbd/
```

instead of:

```text
<some-checkout>/.tbd/data-sync-worktree/
```

This pattern is consistent with other Git-adjacent tooling that stores local,
repo-scoped implementation data under Git storage:

- Git itself stores linked-worktree admin state under `$GIT_COMMON_DIR/worktrees/`.
- Git LFS stores local object cache data under `.git/lfs/`.
- git-annex stores local annex object data under `.git/annex/`.

## Design

### Approach

Create one shared sync worktree per Git common directory:

```text
$GIT_COMMON_DIR/tbd/
  data-sync-worktree/
    .tbd/data-sync/
      issues/
      mappings/
      attic/
      meta.yml
  layout.yml
  locks/
    data-sync.lock/
  backups/
```

Every checkout of the same repository resolves issue data to:

```text
$GIT_COMMON_DIR/tbd/data-sync-worktree/.tbd/data-sync/
```

All mutating operations acquire a common lock before reading, writing, committing,
merging, or repairing the shared sync worktree.

### Why The Git Common Directory, Not The Main Checkout

Some development environments may create linked worktrees where the main checkout is not
obvious, is not mounted where the agent expects, or is not the place the agent should
mutate. Relying on “the main working directory” would make tbd dependent on
environment-specific layout.

`git rev-parse --git-common-dir` is available from any valid linked worktree and points
to shared repository storage.
That is the correct anchor for repo-local tbd machinery.

### Worktree Attachment Model

There are two viable sub-options:

1. **Shared attached worktree:** the shared worktree checks out `tbd-sync` directly.
   Commits naturally advance the branch ref.
2. **Shared detached worktree:** the shared worktree is detached at the `tbd-sync` tip.
   Commits advance HEAD only, and tbd advances `refs/heads/tbd-sync` explicitly.

Preferred draft choice: **shared attached worktree plus common lock**.

Reasons:

- Once there is only one shared sync worktree per Git common directory, attaching it to
  `tbd-sync` no longer causes sibling checkout branch-ownership conflicts.
- Commits made in the shared worktree naturally advance `refs/heads/tbd-sync`; this
  matches the current `initWorktree()` behavior and avoids the detached-HEAD failure
  mode where commits become orphaned from the branch.
- The common lock ensures only one tbd process manipulates the attached shared worktree
  at a time.

Migration may still need a temporary detached scratch path or a legacy cleanup step if
an old per-checkout worktree currently owns `tbd-sync`. The migration must resolve that
ownership before the final shared attached worktree is created.

### Format And Layout Versioning

This change should use one synchronized local-layout format ID in both places that need
to agree, plus a separate synced payload schema.

#### 1. Top-Level `.tbd/` Format

The top-level `.tbd/config.yml` `tbd_format` is the old-client compatibility guard.
The repo already treats `packages/tbd/src/lib/tbd-format.ts` as the single source of
truth for `.tbd/` directory format versions, and older clients should throw
`IncompatibleFormatError` when they see a future format.

This migration should bump the top-level format from `f03` to `f04` because it changes
where sync writes are allowed to happen.
That is a layout-breaking migration, not just an additive local cache.

Draft config shape:

```yaml
tbd_format: f04
tbd_version: ...
display:
  id_prefix: tbd
sync:
  branch: tbd-sync
  remote: origin
  storage: git-common-dir-v1
settings:
  auto_sync: false
  doc_auto_sync_hours: 24
  use_gh_cli: true
```

The exact field name can be finalized during implementation, but the config needs a
durable marker that says the canonical sync storage is the Git common directory.
Putting it under `sync` is attractive because it avoids a new top-level namespace and
keeps branch, remote, and storage policy together.

The `f04` bump is important for mixed-version safety:

- New clients know to use `$GIT_COMMON_DIR/tbd/data-sync-worktree/`.
- Old clients that only support `f03` should fail before mutation instead of silently
  recreating or modifying `<checkout>/.tbd/data-sync-worktree/`.
- Implementation must audit all legacy worktree write paths to confirm config format
  compatibility is checked before creating, repairing, committing, or syncing a legacy
  `.tbd/data-sync-worktree/`.

The config guard is necessary but not sufficient by itself because `.tbd/config.yml` is
branch-visible. A stale linked worktree may still have an `f03` copy of the config until
it rebases or merges the upgrade.
The shared attached worktree is the second guard: once it owns `tbd-sync`, stale old
clients that try to create a legacy attached worktree for the same branch should fail at
Git branch ownership instead of writing divergent local sync state.

#### 2. Git Common-Dir Local Layout

The shared common-dir machinery also needs local layout metadata because future versions
may change lock files, backup locations, worktree attachment mode, or repair metadata.
That metadata should use the same `f04`, `f05`, ... format IDs as top-level
`.tbd/config.yml`, not a second `c01` namespace.

This keeps the contract simple: if the repository says `tbd_format: f04`, then the
Git-common-dir layout for that checkout must also say `tbd_format: f04`. Future
migrations that need both locations to move should advance both to `f05`.

Add a common-dir layout metadata file:

```text
$GIT_COMMON_DIR/tbd/layout.yml
```

Draft shape:

```yaml
tbd_format: f04
sync_storage: git-common-dir-v1
data_sync_worktree: data-sync-worktree
lock_profile: data-sync-v1
created_at: "2026-05-17T00:00:00.000Z"
updated_at: "2026-05-17T00:00:00.000Z"
```

Implementation should use `packages/tbd/src/lib/tbd-format.ts` as the single source of
truth for both top-level `.tbd/config.yml` and `$GIT_COMMON_DIR/tbd/layout.yml` format
IDs.

```typescript
export const CURRENT_FORMAT = 'f04';
```

Common-dir layout policy:

- If `.tbd/config.yml` says `f04` / `git-common-dir-v1` but `layout.yml` is missing, new
  clients should acquire the common lock, check for legacy unsynced data, and initialize
  or migrate the common-dir layout.
  This is expected for fresh clones and newly upgraded checkouts.
- `tbd doctor --fix` should expose the same initialization/repair path explicitly.
- If `layout.yml` contains an unknown future `tbd_format`, new writes should fail fast
  until the user upgrades `tbd`.
- If `.tbd/config.yml` and `$GIT_COMMON_DIR/tbd/layout.yml` disagree on `tbd_format`,
  normal mutating commands should fail closed and route repair through
  `tbd doctor --fix`. Recovery contract (resolved during review): `tbd doctor` must
  diagnose a layout/config mismatch and `tbd doctor --fix` must, under the shared lock,
  rewrite `layout.yml` from the current config when the format is compatible (or report
  the future-format upgrade message when it is not).
  The mismatch error message may name the manual
  `rm "$(git rev-parse --git-common-dir)/tbd/layout.yml"` escape hatch as a secondary
  hint, but the primary remediation is `tbd doctor --fix`. See Post-Review Hardening
  item H3.
- Future common-dir upgrades should be explicit `f04 -> f05` migrations, not ad hoc
  directory probing.

#### 3. Synced Data Schema

The existing `.tbd/data-sync/meta.yml` `schema_version` tracks the schema of the data
that lives on the `tbd-sync` branch.
It should remain separate from the local-layout `tbd_format`.

This design does not require changing the issue payload schema, so the synced data
schema can probably remain at `schema_version: 1`. The implementation should still
extract that value into a named constant and document when to bump it:

- bump `tbd_format` when checkout-visible `.tbd/` config or layout compatibility
  changes;
- bump `.tbd/data-sync/meta.yml` `schema_version` when the synced branch payload
  changes.

### Locking Model

Use the existing directory-lock pattern from `packages/tbd/src/utils/lockfile.ts`. The
lock path should be under the Git common directory:

```text
$GIT_COMMON_DIR/tbd/locks/data-sync.lock
```

Initial locking policy should be conservative:

- Acquire the lock for `setup`/`init` worktree creation.
- Acquire the lock for all commands that mutate issue files, mappings, attic entries, or
  the sync branch.
- Acquire the lock for `sync`, including local commit, fetch, merge, push, and outbox
  import.
- Acquire the lock for migration and doctor repairs.

Read-only commands can eventually avoid the lock, but the first implementation should
prefer correctness and simple reasoning over maximum concurrency.

Review correction (resolved): the first implementation moved read-only commands off the
lock by calling `loadDataContext()` with `{ lock: false }`, but the shared preparation
path it runs (`prepareDataSyncContext`) still repairs the worktree, writes `layout.yml`,
and persists the migrated config.
That means benign reads can race first-use migration, initialization, and repair without
the shared lock — the exact opposite of the safety property above.
The hardening work (item H1) splits preparation into a pure read path and a locked
ensure/migrate/repair path: reads skip the lock only when the shared layout and worktree
are already valid and the config needs no migration; otherwise they must acquire the
shared lock before any mutation.

The current lock helper is tuned for short file writes.
`tbd sync` can include network operations, so this design likely needs either:

- longer timeout and stale windows for the shared data-sync lock, or
- heartbeat metadata inside the lock directory so long-running sync operations do not
  get broken as stale.

### Path Resolution

Add a Git-common-dir resolver, for example:

```typescript
resolveGitCommonDir(cwd): Promise<string>
resolveSharedTbdDir(tbdRoot): Promise<string>
resolveSharedWorktreePath(tbdRoot): Promise<string>
resolveSharedDataSyncDir(tbdRoot): Promise<string>
```

Important details:

- Use `git rev-parse --path-format=absolute --git-common-dir` where supported, or
  normalize a relative `--git-common-dir` against the current checkout.
- Do not inspect or mutate a “main checkout” path.
- Preserve the existing `.tbd/config.yml` lookup from the current checkout’s repo root.
- Update all data path resolution so production code reads and writes the shared data
  directory, not the legacy per-checkout worktree.

### Migration And Compatibility

New versions should treat the common-dir location as canonical.
Old versions must not continue writing per-checkout `.tbd/data-sync-worktree/` after the
repository is upgraded.
The `f04` top-level format bump is the guard that should make older clients stop before
mutation.

Migration requirements:

1. Acquire `$GIT_COMMON_DIR/tbd/locks/data-sync.lock`.
2. Discover legacy `.tbd/data-sync-worktree/` entries using
   `git worktree list --porcelain` plus the current checkout’s legacy path.
3. For each accessible legacy worktree:
   - detect whether it is attached, detached, dirty, or ahead of `tbd-sync`;
   - commit dirty data if needed;
   - merge or publish any ahead commits into `tbd-sync`;
   - preserve backups before destructive repair.
4. Resolve legacy branch ownership so no per-checkout worktree still owns `tbd-sync`.
5. Initialize or update `$GIT_COMMON_DIR/tbd/data-sync-worktree/` from `tbd-sync` as the
   single attached worktree for the sync branch.
6. Write `$GIT_COMMON_DIR/tbd/layout.yml` with `tbd_format: f04` after the shared
   worktree is healthy.
7. Write `.tbd/config.yml` with `tbd_format: f04` and the selected sync storage marker
   as the final step.
8. Leave legacy locations alone initially, or remove them only after a clear successful
   migration and backup.

Compatibility statement:

- New `tbd` can read remote state and migrate old local state.
- Existing repositories upgrade smoothly from `f03` to `f04`.
- If migration fails before the `f04` config write, older clients can still operate on
  the old layout while the user fixes the migration problem.
- If migration reaches the `f04` config write, the shared layout must already be valid;
  older clients should now fail fast instead of writing the old worktree format.
- If an `f04` repo has missing common-dir metadata, new clients may initialize or
  migrate it under the common lock.
- If an `f04` repo has corrupt, mismatched, or future-version common-dir metadata,
  normal writes must fail rather than falling back to legacy paths.
  `tbd doctor --fix` owns recovery.
- Future upgrades should follow the same pattern: migrate local/common data first,
  verify it, then bump the synchronized `tbd_format` marker in both `.tbd/config.yml`
  and `$GIT_COMMON_DIR/tbd/layout.yml` so older writers are blocked.

### Failure Handling

If the shared worktree cannot be initialized or repaired:

- fail with a visible error;
- do not fall back to writing direct `.tbd/data-sync/` in the user checkout;
- point the user to `tbd doctor --fix`;
- preserve any legacy dirty data in backups or outbox before removing anything.

If the lock cannot be acquired:

- fail non-zero for writes and sync;
- report the lock path and stale-lock guidance;
- do not run without mutual exclusion.

## Components

### `packages/tbd/src/lib/tbd-format.ts`

- Add `f04` to `FORMAT_HISTORY`.
- Add `migrate_f03_to_f04()` to set the sync storage marker.
- Update `CURRENT_FORMAT` to `f04`.
- Add tests proving `f03` migrates to `f04` and older format compatibility checks reject
  `f04`.

### Common-Dir Layout Metadata Module

- Add a small module for reading and writing common-dir local layout metadata.
- Reuse `CURRENT_FORMAT` from `tbd-format.ts`; do not create a second common-dir version
  namespace.
- Provide parse, compatibility, and migration helpers for
  `$GIT_COMMON_DIR/tbd/layout.yml`.
- Keep this separate from `.tbd/data-sync/meta.yml` schema handling.

### `packages/tbd/src/lib/schemas.ts`

- Extend `ConfigSchema.sync` with the selected storage marker, for example
  `storage: z.enum(['git-common-dir-v1']).default('git-common-dir-v1')`.
- Add a schema and field order for common-dir `layout.yml`.
- Extract the synced data `schema_version: 1` into a named constant if it is not already
  centralized by the implementation.

### `packages/tbd/src/lib/paths.ts`

- Add shared Git-common-dir path helpers.
- Change production `resolveDataSyncDir()` to prefer the shared worktree path.
- Keep direct-path fallback only for tests and explicit diagnostics.

### `packages/tbd/src/file/git.ts`

- Add shared worktree initialization and health checks.
- Add migration from legacy per-checkout worktrees.
- Add common-dir layout detection.
- Keep branch/ref operations isolated to the shared worktree and the common lock.

### `packages/tbd/src/utils/lockfile.ts`

- Add or document a long-running lock profile for sync.
- Consider lock metadata and heartbeat support before using stale detection around
  network operations.

### `packages/tbd/src/cli/commands/sync.ts`

- Wrap issue sync operations in the shared data-sync lock.
- Use the shared data-sync directory for all list/read/write operations.
- Ensure push/fetch/merge state cannot be concurrently mutated by sibling worktrees.

### `packages/tbd/src/cli/commands/doctor.ts`

- Report shared-worktree health.
- Detect legacy per-checkout worktrees and classify them as migrated, dirty, ahead, or
  safe to remove.
- Offer `--fix` migration.

### Setup And Uninstall Commands

- `tbd setup --auto` and `tbd init` should initialize the shared worktree if needed.
- `tbd uninstall` should understand both legacy per-checkout and shared common-dir local
  machinery.

## API Changes

Potential internal API additions:

```typescript
interface SharedTbdPaths {
  gitCommonDir: string;
  sharedTbdDir: string;
  sharedWorktreePath: string;
  sharedDataSyncDir: string;
  sharedLockPath: string;
  sharedLayoutPath: string;
}

type SharedWorktreeStatus =
  | 'valid'
  | 'missing'
  | 'locked'
  | 'legacy-per-checkout'
  | 'dirty-legacy'
  | 'corrupted';

interface CommonDirLayout {
  tbd_format: 'f04';
  sync_storage: 'git-common-dir-v1';
  data_sync_worktree: 'data-sync-worktree';
  lock_profile: 'data-sync-v1';
  created_at: string;
  updated_at: string;
}
```

No user-facing CLI flags are required for the default workflow.
Doctor output will change to show the shared local sync location.

## Implementation Plan

### Phase 1: Design Spike And Shared Resolver

- [x] Add a small research tryscript proving a hidden worktree under
  `$GIT_COMMON_DIR/tbd/data-sync-worktree/` works from the main checkout and a linked
  worktree.
- [x] Add the common-dir layout metadata module and `layout.yml` schema.
- [x] Add path helpers for absolute Git common directory resolution.
- [x] Add shared lock path helper.
- [x] Add shared worktree health detection without changing production writes yet.
- [x] Add doctor output that reports both the current legacy location and the proposed
  shared location.

### Phase 2: Format Migration And Old-Client Guard

- [x] Add `f04` to `.tbd/config.yml` format history.
- [x] Add the selected sync storage marker to config schema and migration.
- [x] Add a shared command entry helper that reads config and checks format
  compatibility before resolving data paths or initializing worktrees.
- [x] Audit every command that can create or mutate `.tbd/data-sync-worktree/` so config
  compatibility is checked before legacy writes happen.
- [x] Make `f04` plus missing `layout.yml` initialize or migrate under the common lock.
- [x] Make `f04` plus corrupt, mismatched, or future-version `layout.yml` fail closed,
  with repair routed through `tbd doctor --fix`.
- [x] Add an idempotent migration path for rerunning setup or doctor after a partial
  migration.

### Phase 3: Shared Worktree Write Path

- [x] Initialize the shared worktree from local or remote `tbd-sync`.
- [x] Route production `resolveDataSyncDir()` to the shared data-sync directory.
- [x] Wrap mutating commands and sync in the shared lock.
- [x] Update sync to commit/merge/push through the shared worktree.
- [x] Add migration from legacy per-checkout worktrees.
- [x] Update uninstall and cleanup behavior.
- [x] Update docs and troubleshooting guidance.

## Post-Review Hardening (PR #121 Follow-up)

Two senior engineering reviews on PR #121 (the initial review and the review of head
`1e1ff21`) confirmed the design is correct and the bulk of the implementation is solid.
Earlier review items are addressed in the implementation: the lock timing invariant is
restored (`timeoutMs` 35 min > `staleMs` 30 min in `DATA_SYNC_LOCK_OPTIONS`), the
duplicate `WorktreeMissingError`/`WorktreeCorruptedError` definitions are gone, the
`resolveDataSyncDir()` stale-fallback cache no longer caches the direct fallback, the
primary-checkout-only path constants are renamed/documented as non-canonical, and
`uninstall` preserves debug context on shared-path failure.

The remaining work below closes the lock-boundary gaps the second review held the PR
for, plus cleanups surfaced when this branch merged the post-PR-121 `main` (which
dropped Changesets for tag-triggered releases).
Line references are against the merged branch head, not the pre-merge review.

### H1 (Blocking): Make `loadDataContext()` read-only truly read-only

`loadDataContext()` (`packages/tbd/src/cli/lib/data-context.ts:164`) runs with
`{ lock: false }` but still executes `prepareDataSyncContext()`
(`packages/tbd/src/cli/lib/data-context.ts:87`), which mutates shared state without the
lock: worktree repair at `:100`, `writeCommonDirLayout()` at `:120`, and migrated
`writeConfig()` at `:124`.

Fix: split preparation into a pure read path and a locked ensure path.

- Add `ensureSharedDataSyncLayout(tbdRoot, config, sharedPaths)` that performs the
  mutating steps (worktree repair, `layout.yml` write, migrated config write) and is
  only ever called while holding `withSharedDataSyncLock`. Reuse the currently-unused
  `ensureCommonDirLayout()` (`packages/tbd/src/file/common-dir-layout.ts:110`) as the
  layout half rather than duplicating read/validate/write inline.
- Add a cheap validity probe (layout exists and matches config, worktree health `valid`,
  `migrated === false`). When the probe passes, the read path resolves the data-sync dir
  and loads the mapping with no lock.
  When it fails, acquire the shared lock and run the ensure path before resolving.
- Keep `withDataSyncContext(..., { lock: true }, ...)` for writers unchanged.

### H2 (High): Centralize direct init/repair behind one locked ensure entry point

These callers run `initWorktree()`/`repairWorktree()` directly, and `initWorktree()`
calls `migrateLegacyWorktreesToShared()` (`packages/tbd/src/file/git.ts:1124`), so they
perform legacy migration and branch/worktree mutation without the shared lock:

- `tbd init`: `packages/tbd/src/cli/commands/init.ts:176`.
- fresh `tbd setup --auto`: `packages/tbd/src/cli/commands/setup.ts:1668`.
- `tbd doctor --fix`: `packages/tbd/src/cli/commands/doctor.ts:885` (repair) and
  `packages/tbd/src/cli/commands/doctor.ts:971` (init).

(The migration path at `packages/tbd/src/cli/commands/setup.ts:1306` already wraps init
in the shared lock and is the correct model.)

Fix: route every init/migrate/repair caller through one internal “ensure shared sync
layout under lock” entry point.
If `initWorktree()` stays public for tests, document that it requires an outer lock and
wrap the CLI callers in `withSharedDataSyncLock()`.

### H3 (Contract gap): Implement `tbd doctor --fix` for layout mismatch

`validateCommonDirLayout()` (`packages/tbd/src/file/common-dir-layout.ts:57` and `:68`)
currently tells users to manually `rm` `layout.yml`, but this spec’s recovery contract
routes repair through `tbd doctor --fix`, and `doctor.ts` has no `layout.yml` awareness.

Fix: add a `layout.yml` diagnostic to `doctor` (read + validate against config); under
`--fix`, acquire the shared lock and rewrite `layout.yml` from config via
`writeCommonDirLayout()` when the format is compatible, or surface the future-format
upgrade message when it is not.
Update the mismatch error messages so `tbd doctor --fix` is the primary remediation and
the manual `rm` is a secondary hint.
Also surface the future-format **config** upgrade message in `doctor` instead of hiding
it behind a generic “Invalid config file” error.

### H4 (Tests): Lock-boundary and first-use concurrency regression coverage

- Add a concurrency regression test that runs first-use read commands (`tbd list`,
  `tbd ready`, etc.) concurrently from two linked worktrees against (a) an f03 repo and
  (b) an f04 repo with a missing `layout.yml`, asserting exactly one shared
  worktree/`layout.yml` is produced and no legacy/direct `.tbd/data-sync/` path is
  written.
- Add direct unit tests for `ensureSharedDataSyncLayout` running only under the lock and
  for the read fast-path skipping the lock when state is already valid.
- Add a `doctor --fix` test for the layout/config mismatch repair and the future-format
  surfacing.
- Re-run the full unit + golden tryscript suite on the merged branch head; PR #121’s
  green CI predates the `main` merge that refactored `setup.ts`/`doctor.ts`/`status.ts`.

### H5 (Cleanup): Release notes, dead code, and doc drift

- `main` dropped Changesets for tag-triggered releases; the merge left an orphaned
  `.changeset/shared-common-dir-worktree.md`. Move its content (especially the f04
  old-client upgrade note) into `release-notes.md` per the new tag-triggered release
  flow (see project-local `docs/publishing.md`) and delete the changeset file.
- Wire `ensureCommonDirLayout()` into H1 so it is no longer dead code.
- Clarify in `packages/tbd/docs/tbd-design.md` that production migration backups live
  under `$GIT_COMMON_DIR/tbd/backups/`, not `.tbd/backups/`.

### H6 (Residual risk): Stale-lock heartbeat decision

The 30-minute stale window has no heartbeat, so a live `tbd sync` that hangs longer than
`staleMs` can have its lock broken by another process.
Either explicitly accept this risk here (documented trade-off for current data sizes) or
implement heartbeat metadata inside the lock directory.
Recommended: accept the risk for now and track heartbeat as a separate future
enhancement, since it is non-blocking for this PR.

### H7 (Blocking for f04): Make `tbd-sync` internal commits signing-agnostic

Found during review by running the merged suite.
tbd’s machine-generated commits to the `tbd-sync` data branch never disable gpg signing,
so with global `commit.gpgsign=true` and no usable key the `initWorktree` initial commit
(`packages/tbd/src/file/git.ts:1194`,
`git commit --no-verify -m "Initialize tbd-sync branch"`) fails and leaves `tbd-sync`
unborn.

This signing gap is long-standing (released f03 has the identical pattern at
`git.ts:977`, and f03 also leaves `tbd-sync` unborn under signing), but f03 tolerated
it: `tbd create` still wrote issue files and exited 0. f04’s stricter
`git rev-parse HEAD` health check classifies the unborn branch as corrupted and fails
closed, turning the latent gap into a hard failure on the first command (`git init` with
no remote + `tbd init` + `tbd create` → exit 1, “worktree corrupted”). It is also what
fails the merged pre-push/CI suite here (28 tests across `child-order-e2e`,
`spec-inherit`, `specs-flag`, `setup-flows`). Because f04 is what makes it break, it
must be fixed as part of this work, not deferred.

Fix (root cause): add `-c commit.gpgsign=false` to every internal `tbd-sync` commit
(`packages/tbd/src/file/git.ts:1194`, `:1012`, `:1704`;
`packages/tbd/src/cli/commands/sync.ts:446`, `:658`, `:735`, `:861`), ideally via one
shared commit helper — these are automated data commits, not user commits.
Secondary, defense in depth: have f04 init detect a failed initial commit / unborn
`tbd-sync` and surface a clear actionable error instead of opaque “corrupted”.
The merge commit that disabled signing only in the test init helper masked this
production gap.

## Testing Strategy

- Unit tests for Git common-dir path resolution from:
  - primary checkout;
  - linked worktree;
  - subdirectory within either checkout.
- Unit tests for shared lock acquisition, timeout, and stale/heartbeat behavior.
- Worktree health tests for:
  - missing shared worktree;
  - valid shared attached worktree;
  - corrupted shared worktree;
  - legacy per-checkout worktree with dirty data;
  - legacy per-checkout worktree with commits ahead of `tbd-sync`.
- Golden tryscript for the user workflow:
  - initialize tbd in the main checkout;
  - create a Codex-style linked worktree;
  - run `tbd create` in both locations;
  - run `tbd sync` in both locations;
  - assert both use the same `$GIT_COMMON_DIR/tbd/data-sync-worktree/`;
  - assert no direct `.tbd/data-sync/` issue files are created;
  - assert no `fatal: 'tbd-sync' is already used by worktree` output appears.
- Golden tryscript for migration:
  - create legacy per-checkout worktree data;
  - create shared worktree;
  - run `tbd doctor --fix`;
  - assert dirty/ahead legacy data is preserved in `tbd-sync`;
  - assert `$GIT_COMMON_DIR/tbd/layout.yml` is written with `tbd_format: f04`;
  - assert `.tbd/config.yml` is written with `tbd_format: f04` only after the shared
    worktree is valid;
  - assert the shared worktree sees the migrated data.
- Format/version tests:
  - `f03 -> f04` migration writes the sync storage marker;
  - unknown future `tbd_format` fails before legacy worktree mutation;
  - stale linked worktree still seeing `f03` cannot create a legacy attached worktree
    after the shared attached worktree owns `tbd-sync`;
  - unknown future `tbd_format` in `layout.yml` fails before shared worktree mutation;
  - mismatched `.tbd/config.yml` and `$GIT_COMMON_DIR/tbd/layout.yml` `tbd_format`
    values fail closed and route repair through `tbd doctor --fix`;
  - missing `layout.yml` in an otherwise valid `f04` checkout initializes or migrates
    under the common lock;
  - rerunning migration after success is idempotent;
  - interruption before the `f04` config write leaves the legacy layout usable by older
    clients;
  - interruption after the `f04` config write never leaves a missing shared layout.
- Full regression suite:
  - `pnpm build`
  - focused worktree tests
  - sync tryscripts
  - full `pnpm test` before landing

## Rollout Plan

This should ship as a local-layout migration.
On first new-version `tbd setup`, `tbd sync`, or `tbd doctor --fix`, tbd should detect
the old per-checkout worktree layout and either migrate it or clearly report why it
cannot be migrated automatically.

Release notes should warn:

- all active checkouts should upgrade together;
- old versions should fail on the new `f04` format and users should upgrade them rather
  than mixing versions;
- the new canonical local sync worktree lives under the repository Git common directory,
  not under each checkout.

## Open Questions

- Should migration use a temporary detached scratch worktree when a legacy worktree
  still owns `tbd-sync`, or should it always detach/remove the legacy owner before
  creating the shared worktree?
- ~~Should read-only commands take the shared lock initially, or only mutating
  commands?~~ Resolved: read-only commands take the lock only when first-use
  init/migrate/repair is actually needed; once the shared layout and worktree are valid
  they read without the lock (see Post-Review Hardening H1).
- ~~What stale-lock policy is safe for sync operations that include network calls?~~
  Resolved for now: a fixed 35-minute timeout over a 30-minute stale window, no
  heartbeat. Heartbeat metadata is deferred (see Post-Review Hardening H6).
- Should `tbd doctor --fix` remove old legacy worktrees after migration, or leave them
  in place with a marker file?
- How should backups under `$GIT_COMMON_DIR/tbd/backups/` be exposed to users?
- Do we need an escape hatch for environments where `$GIT_COMMON_DIR` is not writable?
- Is `sync.storage` the right config field name, or should storage policy live in a
  separate top-level `layout` namespace?
- Which commands should trigger the automatic `f03 -> f04` migration: setup and doctor
  only, or the first mutating command that needs sync storage?

## References

- `docs/development.md`
- `docs/docs-overview.md`
- `docs/project/specs/active/plan-2026-02-27-id-mapping-safety.md`
- `packages/tbd/src/utils/lockfile.ts`
- `packages/tbd/src/lib/paths.ts`
- `packages/tbd/src/file/git.ts`
- Git worktree documentation: https://git-scm.com/docs/git-worktree
- Git repository layout documentation: https://git-scm.com/docs/gitrepository-layout
- Git rev-parse documentation: https://git-scm.com/docs/git-rev-parse
- Git LFS repository-local storage:
  https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md
- git-annex repository-local storage: https://git-annex.branchable.com/
