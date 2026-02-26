---
title: Multi-Worktree Sync Branch Isolation
description: Preserve current tbd sync workflows while supporting linked worktree AI environments
author: Codex with Joshua Levy guidance
---
# Feature: Multi-Worktree Sync Branch Isolation

**Date:** 2026-02-25 (last updated 2026-02-26)

**Author:** Codex with Joshua Levy guidance

**Status:** Draft

## Overview

tbd sync works well in standard single-checkout repositories, where
`.tbd/data-sync-worktree/` can safely check out local branch `tbd-sync`.

In AI workflows using many linked checkouts (for example Codex sessions), each checkout
attempts to create an inner sync worktree on the same local branch.
Git forbids checking out one local branch in multiple worktrees, causing branch-lock
conflicts.

This spec proposes a minimal-change design that preserves existing sync architecture and
workflows:

- Keep one canonical remote sync branch: `origin/tbd-sync`
- Keep one inner sync worktree per outer checkout
- Use unique local sync branches per checkout when needed (for example
  `tbd-sync--wt-<id>`)
- Push local per-checkout branch to canonical remote branch with explicit refspec

The design goal is seamless behavior in both single-checkout and multi-checkout
environments without replacing the existing worktree model.

## Goals

- Preserve current tbd sync workflows, data model, and user-facing command behavior
- Support multiple linked outer checkouts under one shared git common dir without
  branch-lock conflicts
- Keep fast file-based issue access via per-checkout hidden sync worktree
- Maintain canonical remote branch contract (`origin/tbd-sync`) for interoperability
  across machines
- Avoid silent fallback writes to `.tbd/data-sync/` on main branch in production paths
- Provide robust repair and cleanup behavior for stale per-worktree local sync branches

## Non-Goals

- Replacing worktree-based storage with a new storage architecture
- Introducing symlink-based inner worktree sharing
- Changing synced issue file format, mappings format, attic format, or CLI issue
  semantics
- Renaming canonical remote sync branch away from `tbd-sync`
- Building full real-time locking or daemon-based coordination

## Background

Current architecture (working well today):

- Main branch tracks `.tbd/config.yml`, `.tbd/.gitignore`, `.tbd/.gitattributes`,
  `.tbd/workspaces/`
- `tbd-sync` branch tracks `.tbd/data-sync/` (issues, mappings, attic, meta)
- Hidden inner worktree at `.tbd/data-sync-worktree/` gives direct file access and
  search
- `tbd sync` commits local worktree changes, merges remote, and pushes with
  retry/recovery

Why conflicts happen in linked worktree environments:

- Linked outer checkouts share one git repository metadata directory (`.git` common dir)
- Each outer checkout tries to create/attach its own inner worktree on local branch
  `tbd-sync`
- Git branch checkout rules prevent one local branch from being simultaneously checked
  out in multiple worktrees
- Result: setup/sync errors, non-seamless behavior in AI session workflows

Relevant constraints:

- Need to preserve current outbox, attic, merge, and recovery semantics
- Need to preserve simple UX and avoid introducing large migration risk
- Need to support outer checkout churn (creation/deletion/path changes) in AI systems

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

Release policy for this work: prioritize a clean design over preserving legacy internal
abstractions.

- **Code types, methods, and function signatures**: DO NOT MAINTAIN deprecated internal
  TypeScript APIs. This is a CLI application and we can refactor internal signatures
  without preserving deprecated shims.

- **Library APIs**: DO NOT MAINTAIN (no deprecated compatibility layer needed; tbd is
  CLI-first and does not expose a stable SDK contract for this feature).

- **Server APIs**: N/A.

- **File formats**: SUPPORT BOTH. Existing `.tbd` structures and sync-branch file
  formats remain unchanged.
  Repositories currently using local `tbd-sync` should continue working without
  migration. This compatibility applies only to persisted data formats, not to internal
  code paths.

- **Database schemas**: N/A.

CLI compatibility note:

- CLI should operate the same way for users.
  No intentional breaking CLI command or flag changes are included in this design.

## Design

### Approach

Use split branch roles:

- **Remote canonical sync branch**: `tbd-sync` (shared contract across all environments)
- **Local sync branch** (per outer checkout): one branch per checkout when needed

Key behavior:

1. On sync/worktree init, select local sync branch for this outer checkout
2. If plain local `tbd-sync` is available and not checked out elsewhere, use it
3. Otherwise allocate/reuse a per-checkout local branch like `tbd-sync--wt-<id>`
4. Inner worktree checks out the selected local sync branch
5. Pull/merge reads from `origin/tbd-sync`
6. Push uses explicit refspec: `refs/heads/<localSyncBranch>:refs/heads/tbd-sync`

This avoids branch checkout conflicts while preserving canonical remote behavior.

### Option Analysis

| Option | Summary | Pros | Cons | Decision |
| --- | --- | --- | --- | --- |
| A | Detached inner worktree (no local branch) | Avoids branch lock conflicts | Higher debug complexity; status semantics less intuitive | Rejected for now |
| B | One shared inner worktree in git common dir | Simple branch model | Shared unsynced state across outer checkouts; lock complexity | Rejected |
| C | Ephemeral sync worktree only during sync | No persistent conflicts | Larger behavioral change; weak direct-file UX | Rejected |
| D | Per-checkout local sync branches | Minimal architecture change; preserves workflow | Extra local branch lifecycle cleanup | **Chosen** |

### Branch Naming and Identity

Local sync branch resolution (deterministic for each outer checkout):

1. If local state already has `local_sync_branch`, validate and reuse it when possible
2. Else attempt canonical local sync branch (`config.sync.branch`, usually `tbd-sync`)
   if not checked out elsewhere
3. Else derive a managed branch from the canonical branch and an outer-checkout
   fingerprint
4. Persist selected branch in local state (`.tbd/state.yml`)

Important properties:

- Stable per outer checkout
- Collision-resistant
- Human-debuggable naming
- Does not require config changes for normal users

Managed branch naming:

- Canonical remote branch (unchanged): `config.sync.branch` (default `tbd-sync`)
- Local managed branch pattern: `<remoteBranch>--wt-<fingerprint>`
- Example: `tbd-sync--wt-a1b2c3d4`
- Fingerprint source: normalized absolute outer checkout path
- Fingerprint length: fixed short hex (8 chars)
- Collision fallback: append `-2`, `-3`, ... if branch already exists and is checked out
  by another worktree

Branch naming safety and stability rules:

- Branch names remain valid under existing `GitBranchName` constraints
  (`[a-zA-Z0-9._/-]+`), so no schema change is required
- Managed suffix is always appended to the canonical remote branch string, preserving
  human context when custom sync branches are used
- If canonical branch name is near Git’s max ref length, truncate prefix before adding
  `--wt-<fingerprint>` so managed names always stay within branch-name limits
- Fingerprint input uses normalized real path for stability across `.`/`..` or symlink
  entry paths to the same checkout
- Resolver never rewrites existing user-managed branch names; it only picks canonical or
  managed names for tbd-owned worktrees

### Current Couplings to Resolve

Current code assumes one shared local branch name:

- `packages/tbd/src/cli/commands/sync.ts` uses one `syncBranch` from config for all
  local and remote operations
- `packages/tbd/src/file/git.ts` hardcodes `SYNC_BRANCH` in `ensureWorktreeAttached()`
- `pushWithRetry()` assumes local branch name equals remote branch name in refspec
- `doctor.ts` health checks compare only one branch name for local and remote
- `status.ts` only reports one branch field (`sync_branch`)

Those assumptions are the exact conflict source in linked-worktree environments and must
be separated into:

- `remoteSyncBranch` (canonical, shared) and
- `localSyncBranch` (per outer checkout).

### Branch Resolver Algorithm (Function-Level)

Resolver behavior must be deterministic and side-effect controlled.

Selection and creation are separated:

- `resolveSyncBranchRefs()` selects branch refs and persists local state only when
  `forWrite=true`
- `initWorktree()` / repair paths are responsible for branch creation/checkout

Decision order in `resolveSyncBranchRefs(baseDir, config, { forWrite })`:

1. Read `remoteName` + `remoteSyncBranch` from config
2. Read `.tbd/state.yml` and current `local_sync_branch` (if present)
3. Inspect current worktree occupancy via `git worktree list --porcelain`
4. Reuse state branch if it exists and is not checked out by another worktree
5. Else use canonical local branch (`remoteSyncBranch`) if not occupied elsewhere
6. Else choose deterministic managed branch name from checkout path fingerprint
7. If `forWrite=true`, persist selected branch to `local_sync_branch`

Read-only behavior:

- `forWrite=false` (status/doctor read checks) must not mutate `state.yml`
- If no usable branch is found in read mode, return canonical as informational value and
  report source as `canonical`

### Detailed File-Level Change Plan

#### 1) New Branch-Resolver Module

File: `packages/tbd/src/file/sync-branch.ts` (new)

Purpose:

- Centralize branch-ref resolution
- Keep branch decision logic out of command handlers

Proposed exports:

```ts
export interface SyncBranchRefs {
  remoteName: string;        // config.sync.remote
  remoteSyncBranch: string;  // canonical shared branch (config.sync.branch)
  localSyncBranch: string;   // per-checkout local branch
  source: 'state' | 'canonical' | 'managed';
}

export interface ResolveSyncBranchRefsOptions {
  forWrite?: boolean;
}

export async function resolveSyncBranchRefs(
  baseDir: string,
  config: Config,
  options?: ResolveSyncBranchRefsOptions,
): Promise<SyncBranchRefs>;

export function makeManagedLocalBranchName(
  remoteSyncBranch: string,
  checkoutPath: string,
): string;

export function isManagedLocalBranch(
  localBranch: string,
  remoteSyncBranch: string,
): boolean;

export async function listManagedLocalBranches(
  baseDir: string,
  remoteSyncBranch: string,
): Promise<string[]>;
```

#### 2) Local State Schema and Persistence

Files:

- `packages/tbd/src/lib/schemas.ts`
- `packages/tbd/src/file/config.ts`
- `packages/tbd/src/lib/types.ts` (type inference impact only; no manual interface
  needed)

Changes:

- Add optional local state field:
  - `local_sync_branch: GitBranchName.optional()`
- Update `LOCAL_STATE_FIELD_ORDER` to include `local_sync_branch` before `welcome_seen`
- Keep `state.yml` backward-compatible (optional field, permissive parse)

#### 3) Git Helpers (Worktree and Branch Plumbing)

File: `packages/tbd/src/file/git.ts`

Function signature updates:

```ts
initWorktree(
  baseDir: string,
  remote = 'origin',
  remoteSyncBranch = SYNC_BRANCH,
  localSyncBranch = remoteSyncBranch,
): Promise<{ success: boolean; path?: string; created?: boolean; error?: string }>;

updateWorktree(
  baseDir: string,
  remote = 'origin',
  remoteSyncBranch = SYNC_BRANCH,
  localSyncBranch = remoteSyncBranch,
): Promise<{ success: boolean; error?: string }>;

repairWorktree(
  baseDir: string,
  status: 'missing' | 'prunable' | 'corrupted',
  remote = 'origin',
  remoteSyncBranch = SYNC_BRANCH,
  localSyncBranch = remoteSyncBranch,
): Promise<{ success: boolean; path?: string; backedUp?: string; error?: string }>;

ensureWorktreeAttached(
  worktreePath: string,
  expectedLocalBranch: string,
): Promise<boolean>;

pushWithRetry(
  localSyncBranch: string,
  remoteName: string,
  remoteSyncBranch: string,
  onMergeNeeded: () => Promise<ConflictEntry[]>,
  baseDir?: string,
): Promise<PushResult>;

checkRemoteBranchHealth(
  remoteName = 'origin',
  remoteSyncBranch = SYNC_BRANCH,
  localSyncBranch = remoteSyncBranch,
): Promise<RemoteBranchHealth>;

checkSyncConsistency(
  baseDir: string,
  localSyncBranch = SYNC_BRANCH,
  remoteName = 'origin',
  remoteSyncBranch = localSyncBranch,
): Promise<SyncConsistency>;
```

New helpers (same file):

- `listWorktreeBranchRefs(baseDir)` from `git worktree list --porcelain`
- `isBranchCheckedOutInOtherWorktree(baseDir, branch, currentWorktreePath?)`

Behavior requirements:

- `initWorktree()` checks/creates `localSyncBranch` while fetching from
  `${remote}/${remoteSyncBranch}`
- First-time creation rules:
  - remote exists:
    `worktree add -b <localSyncBranch> <path> <remote>/<remoteSyncBranch>`
  - remote missing but local exists: `worktree add <path> <localSyncBranch>`
  - neither exists: orphan-init `localSyncBranch`
- `pushWithRetry()` uses explicit split refspec:
  - `refs/heads/<localSyncBranch>:refs/heads/<remoteSyncBranch>`
- `migrateDataToWorktree()` updates to
  `ensureWorktreeAttached(worktreePath, expectedLocalBranch)` call path

#### 4) Sync Command Integration

File: `packages/tbd/src/cli/commands/sync.ts`

Structural updates:

- Add cached refs field in handler:
  - `private syncRefs: SyncBranchRefs | null = null`
- In `run()`:
  - load config immediately after `requireInit()`
  - resolve refs once via `resolveSyncBranchRefs(tbdRoot, config, { forWrite: true })`
  - pass refs into all health-repair and sync paths

Method-level signature updates:

```ts
private async showIssueStatus(refs: SyncBranchRefs): Promise<void>;
private async getSyncStatus(refs: SyncBranchRefs): Promise<SyncStatus>;
private async pullChanges(refs: SyncBranchRefs): Promise<void>;
private async pushChanges(refs: SyncBranchRefs): Promise<void>;
private async doPushWithRetry(refs: SyncBranchRefs): Promise<PushResult>;
private async fullSync(
  refs: SyncBranchRefs,
  options: { force?: boolean; autoSave?: boolean; outbox?: boolean },
): Promise<void>;
private async maybeImportOutbox(refs: SyncBranchRefs): Promise<void>;
```

`SyncStatus` update:

- keep existing fields
- add `localSyncBranch` and `remoteSyncBranch` for JSON/debug clarity

Command behavior updates:

- `doRepairWorktree()` calls
  `repairWorktree(..., refs.remoteName, refs.remoteSyncBranch, refs.localSyncBranch)`
- `commitWorktreeChanges()` calls
  `ensureWorktreeAttached(worktreePath, refs.localSyncBranch)`
- All `fetch`, `rev-list`, `log`, and `git show` operations use:
  - local side: `refs.localSyncBranch`
  - remote side: `${refs.remoteName}/${refs.remoteSyncBranch}`
- User-facing text remains canonical-first (show remote sync branch as primary)

#### 5) Doctor Command Integration

File: `packages/tbd/src/cli/commands/doctor.ts`

Structural updates:

- Add cached refs field:
  - `private syncRefs: SyncBranchRefs | null = null`
- Resolve refs once after config load:
  - read checks: `forWrite=false`
  - fix path (`--fix`): `forWrite=true`

Function-level updates:

- `checkWorktree()` repair call threads split refs into `repairWorktree(...)`
- `checkDataLocation()` fix path `initWorktree(...)` call threads split refs
- `checkLocalSyncBranch()` targets `refs.localSyncBranch`
- `checkRemoteSyncBranch()` calls
  `checkRemoteBranchHealth(refs.remoteName, refs.remoteSyncBranch, refs.localSyncBranch)`
- `checkSyncConsistency()` calls
  `checkSyncConsistency(this.cwd, refs.localSyncBranch, refs.remoteName, refs.remoteSyncBranch)`

New diagnostics/fixes:

- state says branch X but X missing locally
- state branch occupied by another worktree
- inner worktree attached to wrong branch
- optional `--fix`: prune stale managed branches (never current branch, never checked
  out)

#### 6) Status Command and Shared Section Rendering

Files:

- `packages/tbd/src/cli/commands/status.ts`
- `packages/tbd/src/cli/lib/sections.ts`

Changes:

- `StatusData` adds `local_sync_branch: string | null`
- `loadPostInitInfo()` resolves refs in read mode and sets:
  - `sync_branch = remoteSyncBranch`
  - `local_sync_branch = localSyncBranch`
- `ConfigSectionData` extends with optional `localSyncBranch`
- text render rule:
  - always show `Sync branch: <remoteSyncBranch>`
  - show `Local sync branch: <localSyncBranch>` only when different
- JSON output includes both fields so automation/agents can diagnose conflicts

#### 7) Init and Setup Paths

Files:

- `packages/tbd/src/cli/commands/init.ts`
- `packages/tbd/src/cli/commands/setup.ts`

`init.ts` updates:

- After config creation, read config and resolve refs with `forWrite=true`
- Pass resolved refs to `initWorktree(...)`
- If `--sync-branch` / `--remote` are provided, write those values to config before
  resolving refs (preserves current CLI intent)

`setup.ts` updates (`initializeTbd()`):

- After `initConfig(...)`, read config and resolve refs with `forWrite=true`
- Call `initWorktree(cwd, refs.remoteName, refs.remoteSyncBranch, refs.localSyncBranch)`

#### 8) Uninstall Consistency

File: `packages/tbd/src/cli/commands/uninstall.ts`

Changes:

- Resolve refs in read mode for branch discovery
- Collect removable local branches:
  - canonical local branch (if present)
  - managed local branches matching `<remoteSyncBranch>--wt-*`
- `--keep-branch` preserves all local sync branches
- deletion safety:
  - never delete branch currently checked out in any worktree
  - show warnings for skipped branches
- remote deletion remains scoped to canonical remote branch and `--remove-remote`

### Scope Clarification: Path Fallback Hardening

This spec keeps focus on branch/worktree conflict resolution.

- `resolveDataSyncDir()` global fallback semantics are **not** changed as part of this
  rollout.
- Existing sync/doctor worktree health protections remain in place.
- Any repo-wide strict-path hardening will be a separate follow-up spec to avoid
  accidental behavior changes in unrelated commands.

### API Changes

User-facing CLI flags:

- No required new flags for baseline behavior
- Existing `tbd sync` behavior remains unchanged from user perspective

Internal contract changes:

- Sync internals distinguish `localSyncBranch` from `remoteSyncBranch`
- Push/pull code paths no longer assume local and remote branch names are identical

Internal data model additions:

- `.tbd/state.yml`
  - `local_sync_branch?: string`

### Corner Cases and Expected Behavior

| Scenario | Expected Behavior |
| --- | --- |
| Standard single checkout | Uses local `tbd-sync`, no visible behavior change |
| Two linked outer checkouts start fresh | First may use local `tbd-sync`, second auto-uses `tbd-sync--wt-*` |
| Outer checkout moved/renamed | New branch may be allocated; old branch becomes stale and prunable by doctor |
| Outer checkout deleted abruptly | Stale local branch remains until doctor cleanup |
| Existing inner worktree detached HEAD | Auto-repair reattaches to selected local sync branch |
| Local branch missing but state points to it | Repair recreates branch from remote canonical |
| Remote `origin/tbd-sync` missing | Initial orphan/first-push workflow remains supported |
| Concurrent sync from two outer checkouts | Normal git non-fast-forward retries and merge handling apply |
| Push denied (HTTP 403) | Existing outbox auto-save behavior remains unchanged |
| Data mistakenly written to direct path | Doctor migration/repair still applies; no silent production fallback |
| Canonical branch name changed in config | Local branches still per-checkout, remote target follows config |
| Copied checkout with stale `state.yml` branch | Resolver detects branch in use elsewhere and reallocates managed branch |
| Managed branch exists but was manually deleted | Resolver recreates from remote canonical branch when possible |
| Managed branch exists but points to unrelated history | Doctor warns; `--fix` reattaches/recreates managed branch |

### Failure Safety

- No destructive operations on canonical remote branch refs
- No destructive branch cleanup without explicit safety checks
- Stale branch cleanup limited to managed prefix (`<remoteSyncBranch>--wt-`) and only
  when not checked out
- Preserve current attic/outbox recovery paths

## Implementation Plan

### Phase 1: Branch Ref Infrastructure

- [ ] Add `packages/tbd/src/file/sync-branch.ts`:
  - [ ] `resolveSyncBranchRefs(baseDir, config, options)`
  - [ ] `makeManagedLocalBranchName(remoteSyncBranch, checkoutPath)`
  - [ ] `isManagedLocalBranch(localBranch, remoteSyncBranch)`
  - [ ] `listManagedLocalBranches(baseDir, remoteSyncBranch)`
- [ ] Add git worktree inspection helpers in `packages/tbd/src/file/git.ts`:
  - [ ] `listWorktreeBranchRefs(baseDir)`
  - [ ] `isBranchCheckedOutInOtherWorktree(baseDir, branch, currentWorktreePath?)`
- [ ] Extend state schema and serialization:
  - [ ] `packages/tbd/src/lib/schemas.ts`: `LocalStateSchema.local_sync_branch`
  - [ ] `packages/tbd/src/lib/schemas.ts`: `LOCAL_STATE_FIELD_ORDER`
  - [ ] `packages/tbd/src/file/config.ts`: verify read/write/update state flows

Acceptance criteria:
- Deterministic resolver output for same checkout path + same worktree occupancy
- Read-only resolution does not write `state.yml`
- Write-mode resolution persists and reuses `local_sync_branch`

### Phase 2: Git Layer Ref Separation

- [ ] Update signatures and internal logic in `packages/tbd/src/file/git.ts`:
  - [ ] `initWorktree(...)` split local/remote refs
  - [ ] `updateWorktree(...)` split local/remote refs
  - [ ] `repairWorktree(...)` split local/remote refs
  - [ ] `ensureWorktreeAttached(worktreePath, expectedLocalBranch)`
  - [ ] `pushWithRetry(localSyncBranch, remoteName, remoteSyncBranch, ...)`
  - [ ] `checkRemoteBranchHealth(remoteName, remoteSyncBranch, localSyncBranch)`
  - [ ] `checkSyncConsistency(baseDir, localSyncBranch, remoteName, remoteSyncBranch)`
  - [ ] `migrateDataToWorktree(...)` call-site update for `ensureWorktreeAttached`

Acceptance criteria:
- No branch helper assumes local branch name equals remote branch name
- Push/pull/rev-list operations use explicit split refs
- Single-checkout behavior remains unchanged (`localSyncBranch === remoteSyncBranch`)

### Phase 3: Command Integration

- [ ] `packages/tbd/src/cli/commands/sync.ts`:
  - [ ] resolve refs once in `run()`
  - [ ] thread refs through `showIssueStatus`, `getSyncStatus`, `pullChanges`,
    `pushChanges`, `doPushWithRetry`, `fullSync`, and `maybeImportOutbox`
  - [ ] pass refs into worktree repair path and `ensureWorktreeAttached`
- [ ] `packages/tbd/src/cli/commands/doctor.ts`:
  - [ ] resolve refs once (read-only vs `--fix`)
  - [ ] update local/remote/consistency checks to split refs
  - [ ] add branch-binding drift diagnostics
  - [ ] add safe stale managed-branch cleanup in fix mode
- [ ] `packages/tbd/src/cli/commands/status.ts` and
  `packages/tbd/src/cli/lib/sections.ts`:
  - [ ] add `local_sync_branch` to JSON payload
  - [ ] add optional local-branch line in text output
- [ ] `packages/tbd/src/cli/commands/init.ts`:
  - [ ] persist `--sync-branch` / `--remote` overrides to config
  - [ ] resolve refs and call split-ref `initWorktree(...)`
- [ ] `packages/tbd/src/cli/commands/setup.ts`:
  - [ ] resolve refs and call split-ref `initWorktree(...)` in `initializeTbd()`
- [ ] `packages/tbd/src/cli/commands/uninstall.ts`:
  - [ ] discover managed branches for same canonical remote branch
  - [ ] safe-delete non-checked-out managed branches when not `--keep-branch`

Acceptance criteria:
- Multiple linked outer checkouts can all run `tbd sync` without branch checkout errors
- Canonical remote branch remains `config.sync.branch`
- User-facing command semantics remain stable

## Testing Strategy

Unit tests:

- Add new test file: `packages/tbd/tests/sync-branch.test.ts`
  - deterministic managed-name generation
  - read-only vs write-mode resolver behavior
  - state reuse/reallocation when branch is occupied elsewhere
  - collision suffix behavior (`-2`, `-3`, ...)
- Update `packages/tbd/tests/worktree-health.test.ts`
  - split-ref checks for `checkRemoteBranchHealth` and `checkSyncConsistency`
  - `ensureWorktreeAttached(worktreePath, expectedLocalBranch)` branch reattach cases
- Update `packages/tbd/tests/config.test.ts` or `packages/tbd/tests/schemas.test.ts`
  - `local_sync_branch` parse/write ordering behavior

Integration/e2e tests:

- Update `packages/tbd/tests/git-remote.test.ts`
  - two local branches push to one canonical remote branch
- Update `packages/tbd/tests/cli-sync-worktree-scenarios.tryscript.md`
  - linked-worktree scenario: two outer checkouts, one canonical remote branch
- Update `packages/tbd/tests/cli-sync-remote.tryscript.md`
  - JSON/status assertions include split refs (if exposed)
- Update `packages/tbd/tests/cli-status.tryscript.md`
  - text output local branch line shown only when different
- Update `packages/tbd/tests/cli-uninstall.tryscript.md`
  - managed-branch cleanup behavior and `--keep-branch` behavior
- Regression for outbox flow in `packages/tbd/tests/cli-sync.tryscript.md` and/or
  `packages/tbd/tests/doctor-sync.test.ts`
  - verify HTTP 403 save/import behavior unchanged

Regression tests:

- Single-checkout flow remains unchanged
- Existing repositories with local `tbd-sync` continue syncing correctly
- Existing worktree corruption/missing-worktree repair tests remain passing
- `tbd setup --auto` and `tbd init` still succeed in a standard single checkout

Validation matrix:

- Git 2.42+ (required for orphan worktree behavior)
- macOS/Linux (baseline)
- AI multi-checkout environment simulation using linked worktrees

## Rollout Plan

1. Implement under existing sync flow with no opt-in required
2. First sync in each checkout auto-selects/persists local sync branch
3. Existing single-checkout repositories continue on local `tbd-sync`
4. Linked-worktree environments transparently transition to per-checkout local branches
5. Doctor provides cleanup guidance for stale local branch artifacts
6. Update troubleshooting docs with multi-checkout behavior notes

## Locked Decisions

- Fingerprint input uses normalized real checkout path only (no extra repository ID
  salt)
- Status text shows `Local sync branch` only when it differs from canonical sync branch
- Managed-branch pruning is fix-only (`tbd doctor --fix` / uninstall paths), not normal
  sync
- No new CLI flags are added for this release; existing debug mode can include split
  refs

## References

- [tbd design doc](/Users/levy/wrk/github/tbd/packages/tbd/docs/tbd-design.md)
- [sync command implementation](/Users/levy/wrk/github/tbd/packages/tbd/src/cli/commands/sync.ts)
- [git worktree helpers](/Users/levy/wrk/github/tbd/packages/tbd/src/file/git.ts)
- [path resolution](/Users/levy/wrk/github/tbd/packages/tbd/src/lib/paths.ts)
- [sync troubleshooting guideline](/Users/levy/wrk/github/tbd/packages/tbd/docs/guidelines/tbd-sync-troubleshooting.md)
- [worktree recovery/hardening spec](/Users/levy/wrk/github/tbd/docs/project/specs/done/plan-2026-01-28-sync-worktree-recovery-and-hardening.md)
