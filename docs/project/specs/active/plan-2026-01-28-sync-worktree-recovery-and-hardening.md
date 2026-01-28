# Feature: Sync Worktree Recovery and Hardening

**Date:** 2026-01-28

**Author:** Claude (with Joshua Levy)

**Status:** Draft

## Overview

The tbd sync system has critical bugs that allow data loss and silent failures.
When the hidden worktree (`.tbd/data-sync-worktree/`) is missing or corrupted, the
system:
1. Silently falls back to writing data to the wrong location (`.tbd/data-sync/`)
2. Reports “Already in sync” when hundreds of issues have never been synced
3. Fails to detect or recover from worktree corruption

This spec addresses comprehensive fixes to make sync robust, recoverable, and fail-safe.

## Goals

- **G1**: Sync should NEVER report “in sync” when data hasn’t been synced
- **G2**: Missing/corrupted worktree should be automatically repaired
- **G3**: Path resolution should be consistent across all sync operations
- **G4**: Clear error messages when sync cannot proceed
- **G5**: Recovery path for existing repos with data in wrong location

## Non-Goals

- Changing the fundamental worktree architecture (that’s working correctly when set up)
- Supporting non-worktree sync modes (the fallback path is the bug, not a feature)
- Backward compatibility with the broken state (we fix it, not preserve it)

## Background

### Incident: ai-trade-arena Data Loss

On 2026-01-28, discovered that the ai-trade-arena repo had 951 issues in
`.tbd/data-sync/` that were never synced to the `tbd-sync` branch.
The remote branch only contained the initial commit from Jan 17, while issues were
actively created through Jan 27.

**Timeline:**
- Jan 17: tbd initialized, worktree created, initial commit pushed
- Jan 18: Beads migration imported ~950 issues
- Jan 18-27: Issues created/modified, never synced
- Jan 28: `tbd sync` reported “Already in sync” (false)

### Root Cause Analysis

**Bug 1: Path Mismatch in sync.ts**
```typescript
// Line 57 - data operations use resolved path
this.dataSyncDir = await resolveDataSyncDir(tbdRoot);  // → .tbd/data-sync/ (fallback)

// Line 273, 427 - commit operations use hardcoded path
const worktreePath = join(process.cwd(), WORKTREE_DIR);  // → .tbd/data-sync-worktree
```

Data is read/written via `dataSyncDir` but commit operations target `worktreePath`.

**Bug 2: getSyncStatus checks gitignored path**
```typescript
// Line 140 - runs on MAIN branch where data-sync/ is gitignored!
const status = await git('status', '--porcelain', DATA_SYNC_DIR);
```

Returns empty because `.tbd/data-sync/` is in `.tbd/.gitignore`.

**Bug 3: Silent fallback in resolveDataSyncDir**
```typescript
// paths.ts lines 225-246
export async function resolveDataSyncDir(baseDir): Promise<string> {
  try {
    await access(worktreePath);  // Check if worktree exists
    return worktreePath;
  } catch {
    return directPath;  // SILENT fallback - no warning, no error
  }
}
```

**Bug 4: No worktree health check before sync**
- Sync doesn’t verify worktree exists before operations
- Should call `updateWorktree()` which would recreate if missing

**Bug 5: commitWorktreeChanges fails silently**
```typescript
// Line 300-306 - catches errors but only checks for "nothing to commit"
} catch (error) {
  const msg = (error as Error).message;
  if (msg.includes('nothing to commit')) {
    return emptyTallies();
  }
  throw error;  // Other errors (like missing dir) may not reach here
}
```

### Comparison: Working vs Broken Repos

| Aspect | TBD (Working) | ai-trade-arena | markform | lexikon-site |
| --- | --- | --- | --- | --- |
| Failure Mode | None | Worktree deleted | Never initialized | Never pushed |
| `data-sync-worktree/` | EXISTS | MISSING (prunable) | MISSING | EXISTS |
| Local tbd-sync | EXISTS | EXISTS | MISSING | EXISTS |
| Remote tbd-sync | EXISTS | EXISTS (empty) | MISSING | MISSING |
| Wrong location issues | 0 | 957 | 8 | 0 |
| Correct location issues | 603 | 0 | 0 | 0 |
| Severity | OK | CRITICAL | CRITICAL | MINOR |
| Doctor --fix action | N/A | Prune + recreate + migrate | Create + migrate | Just sync |

**Three distinct failure modes:**

1. **Worktree deleted** (ai-trade-arena): Worktree was created, then deleted.
   Git still tracks it as “prunable”.
   Branches exist. Data written to wrong fallback path.
   - Fix: `git worktree prune`, recreate worktree, migrate data, push

2. **Never initialized** (markform): Worktree was never created (possibly due to older
   tbd version or interrupted setup).
   No branches exist. Data written to wrong path.
   - Fix: Create orphan branch, create worktree, migrate data, push

3. **Never pushed** (lexikon-site): Everything local is correct, but remote branch
   doesn’t exist. User just needs to push.
   - Fix: Run `tbd sync` to push

## Design

### Approach

1. **Fail-fast, not fail-silent**: If worktree is missing, ERROR immediately
2. **Auto-repair**: Attempt to recreate worktree before erroring
3. **Path consistency**: Use a single source of truth for data path
4. **Migration support**: Handle repos with data in wrong location

### Key Principles

- The worktree path is the ONLY correct path for data in production
- The direct path (`.tbd/data-sync/`) is ONLY for tests without git
- Any data in the direct path in a real repo indicates a bug or migration need

### Components

#### 1. Enhanced Path Resolution (paths.ts)

```typescript
export async function resolveDataSyncDir(
  baseDir: string = process.cwd(),
  options?: { allowFallback?: boolean; repair?: boolean }
): Promise<string> {
  const worktreePath = join(baseDir, DATA_SYNC_DIR_VIA_WORKTREE);

  // Check if worktree exists
  if (await pathExists(worktreePath)) {
    return worktreePath;
  }

  // Attempt repair if requested
  if (options?.repair) {
    const result = await initWorktree(baseDir);
    if (result.success) {
      return worktreePath;
    }
  }

  // Only allow fallback in test mode
  if (options?.allowFallback) {
    return join(baseDir, DATA_SYNC_DIR);
  }

  // Fail with clear error
  throw new WorktreeMissingError(
    'Worktree not found at .tbd/data-sync-worktree/. ' +
    'Run `tbd doctor --fix` to repair.'
  );
}
```

#### 2. Sync Command Hardening (sync.ts)

```typescript
async run(options: SyncOptions): Promise<void> {
  // FIRST: Ensure worktree exists and is healthy
  const worktreeStatus = await checkWorktreeHealth(tbdRoot);
  if (!worktreeStatus.healthy) {
    if (options.fix || options.force) {
      await this.repairWorktree(tbdRoot);
    } else {
      throw new WorktreeError(
        `Worktree is ${worktreeStatus.status}. ` +
        `Run 'tbd sync --fix' to repair.`
      );
    }
  }

  // Now safe to resolve path - worktree guaranteed to exist
  this.dataSyncDir = await resolveDataSyncDir(tbdRoot);

  // ... rest of sync
}
```

#### 3. Worktree Health Check (git.ts)

```typescript
export async function checkWorktreeHealth(baseDir: string): Promise<{
  healthy: boolean;
  status: 'valid' | 'missing' | 'prunable' | 'corrupted';
  details?: string;
}> {
  const worktreePath = join(baseDir, WORKTREE_DIR);

  // Check directory exists
  if (!await pathExists(worktreePath)) {
    return { healthy: false, status: 'missing' };
  }

  // Check .git file exists and points to valid location
  const gitFile = join(worktreePath, '.git');
  if (!await pathExists(gitFile)) {
    return { healthy: false, status: 'corrupted', details: 'Missing .git file' };
  }

  // Check git worktree list for prunable status
  const worktreeList = await git('worktree', 'list', '--porcelain');
  if (worktreeList.includes('prunable')) {
    return { healthy: false, status: 'prunable', details: 'Git reports prunable' };
  }

  return { healthy: true, status: 'valid' };
}
```

#### 4. Doctor Command Enhancement (doctor.ts)

The doctor command should perform comprehensive health checks on all sync-related
components: worktree, local branch, and remote branch.

```typescript
// =============================================================================
// 1. WORKTREE HEALTH CHECK
// =============================================================================
const worktreeStatus = await checkWorktreeHealth(tbdRoot);
if (!worktreeStatus.healthy) {
  issues.push({
    severity: 'error',
    message: `Worktree is ${worktreeStatus.status}`,
    fix: 'Run `tbd doctor --fix` to repair',
    autoFixable: true,
  });
}

// =============================================================================
// 2. LOCAL BRANCH HEALTH CHECK
// =============================================================================
const localBranchStatus = await checkLocalBranchHealth(syncBranch);
if (!localBranchStatus.exists) {
  issues.push({
    severity: 'error',
    message: `Local branch '${syncBranch}' does not exist`,
    fix: 'Run `tbd doctor --fix` to create from remote or initialize',
    autoFixable: true,
  });
} else if (localBranchStatus.orphaned) {
  // Branch exists but has no commits (empty orphan)
  issues.push({
    severity: 'warning',
    message: `Local branch '${syncBranch}' exists but has no commits`,
    fix: 'This may be normal for a new repo, or run `tbd sync` to push data',
    autoFixable: false,
  });
}

// =============================================================================
// 3. REMOTE BRANCH HEALTH CHECK
// =============================================================================
const remoteBranchStatus = await checkRemoteBranchHealth(remote, syncBranch);
if (!remoteBranchStatus.exists) {
  issues.push({
    severity: 'warning',
    message: `Remote branch '${remote}/${syncBranch}' does not exist`,
    fix: 'Run `tbd sync` to push local branch to remote',
    autoFixable: false,
  });
} else if (remoteBranchStatus.diverged) {
  issues.push({
    severity: 'warning',
    message: `Local and remote '${syncBranch}' have diverged`,
    fix: 'Run `tbd sync` to reconcile changes',
    autoFixable: false,
  });
}

// =============================================================================
// 4. SYNC STATE CONSISTENCY CHECK
// =============================================================================
// NOTE: Only run these checks if worktree is healthy. If worktree is missing/prunable,
// we already reported that error above and these checks would produce misleading results.
if (worktreeStatus.healthy) {
  const syncConsistency = await checkSyncConsistency(tbdRoot, syncBranch, remote);

  // Check: worktree HEAD matches local branch
  if (!syncConsistency.worktreeMatchesLocal) {
    issues.push({
      severity: 'error',
      message: `Worktree HEAD does not match local '${syncBranch}' branch`,
      details: `Worktree: ${syncConsistency.worktreeHead}, Branch: ${syncConsistency.localHead}`,
      fix: 'Run `tbd doctor --fix` to reset worktree to branch HEAD',
      autoFixable: true,
    });
  }

  // Check: local has unpushed commits
  if (syncConsistency.localAhead > 0) {
    issues.push({
      severity: 'info',
      message: `Local '${syncBranch}' is ${syncConsistency.localAhead} commit(s) ahead of remote`,
      fix: 'Run `tbd sync` to push changes',
      autoFixable: false,
    });
  }

  // Check: remote has unpulled commits
  if (syncConsistency.localBehind > 0) {
    issues.push({
      severity: 'info',
      message: `Local '${syncBranch}' is ${syncConsistency.localBehind} commit(s) behind remote`,
      fix: 'Run `tbd sync` to pull changes',
      autoFixable: false,
    });
  }
}

// =============================================================================
// 5. DATA LOCATION CHECK
// =============================================================================
// Check for data in wrong location (direct path instead of worktree)
const wrongPath = join(tbdRoot, DATA_SYNC_DIR);
const wrongPathIssues = await listIssues(wrongPath).catch(() => []);
if (wrongPathIssues.length > 0) {
  issues.push({
    severity: 'error',
    message: `Found ${wrongPathIssues.length} issues in wrong location (.tbd/data-sync/)`,
    fix: 'Run `tbd doctor --fix` to migrate to worktree',
    autoFixable: true,
  });
}

// Check: local data exists but remote is empty (the ai-trade-arena bug)
// This can happen in two scenarios:
// 1. Worktree is healthy but data never pushed
// 2. Worktree is unhealthy/missing but data exists in wrong location
if (remoteBranchStatus.exists) {
  const remoteIssueCount = await countRemoteIssues(remote, syncBranch);

  if (remoteIssueCount === 0) {
    // Check for data in correct location (worktree)
    if (worktreeStatus.healthy) {
      const worktreeIssueCount = await countIssues(join(tbdRoot, DATA_SYNC_DIR_VIA_WORKTREE));
      if (worktreeIssueCount > 0) {
        issues.push({
          severity: 'error',
          message: `Local worktree has ${worktreeIssueCount} issues but remote has none - data not synced!`,
          fix: 'Run `tbd sync` to push local issues to remote',
          autoFixable: false,
        });
      }
    }

    // Check for data in wrong location (already detected above, but add context about remote)
    if (wrongPathIssues.length > 0) {
      issues.push({
        severity: 'error',
        message: `Remote '${syncBranch}' has no issues - the ${wrongPathIssues.length} local issues were never synced`,
        fix: 'Run `tbd doctor --fix` to repair worktree and migrate data, then `tbd sync`',
        autoFixable: false,
      });
    }
  }
}

// =============================================================================
// 6. MULTI-USER / CLONE SCENARIO CHECK
// =============================================================================
// Detect when a user clones a repo where issues should exist but don't.
// This catches the case where User A had sync issues, and User B clones
// and sees no issues despite evidence they should exist.

const tbdIssueCount = worktreeStatus.healthy
  ? await countIssues(join(tbdRoot, DATA_SYNC_DIR_VIA_WORKTREE))
  : 0;

// Check 1: Beads migration evidence exists but tbd has no issues
const beadsDisabledPath = join(tbdRoot, '.beads-disabled');
const beadsPath = join(tbdRoot, '.beads');
const beadsMigrationExists = await pathExists(beadsDisabledPath);
const beadsActiveExists = await pathExists(beadsPath);

if (beadsMigrationExists && tbdIssueCount === 0 && wrongPathIssues.length === 0) {
  // User B scenario: cloned repo with beads migration but no tbd issues
  const beadsJsonl = join(beadsDisabledPath, '.beads', 'issues.jsonl');
  let beadsIssueCount = 0;
  try {
    const content = await readFile(beadsJsonl, 'utf-8');
    beadsIssueCount = content.trim().split('\n').filter(Boolean).length;
  } catch { /* ignore */ }

  if (beadsIssueCount > 0) {
    issues.push({
      severity: 'error',
      message: `Beads migration exists with ${beadsIssueCount} issues, but tbd has none`,
      details: 'This repo was migrated from beads but issues were never synced to remote. ' +
               'Another user may have the issues locally but they were not pushed.',
      fix: 'Contact the repo owner to run `tbd sync` and push their local issues',
      autoFixable: false,
    });
  }
}

// Check 2: Config has id_prefix set but no issues exist (suggests prior usage)
if (tbdIssueCount === 0 && wrongPathIssues.length === 0 && !beadsMigrationExists) {
  const config = await readConfig(tbdRoot).catch(() => null);
  if (config?.display?.id_prefix) {
    // id_prefix is set, which suggests issues were created at some point
    // But we have no issues - this is suspicious
    issues.push({
      severity: 'warning',
      message: `Config has id_prefix '${config.display.id_prefix}' but no issues exist`,
      details: 'This suggests issues may have been created but not synced, ' +
               'or were lost due to sync issues on another machine.',
      fix: 'If you expect issues to exist, contact the repo owner',
      autoFixable: false,
    });
  }
}

// Check 3: Active beads directory exists (not migrated yet)
if (beadsActiveExists && tbdIssueCount === 0) {
  issues.push({
    severity: 'info',
    message: 'Beads directory exists - migration to tbd available',
    fix: 'Run `tbd import --beads` to migrate beads issues to tbd',
    autoFixable: false,
  });
}
```

#### 4b. Health Check Helper Functions (git.ts)

```typescript
/**
 * Check local sync branch health.
 */
export async function checkLocalBranchHealth(syncBranch: string): Promise<{
  exists: boolean;
  orphaned: boolean;
  head?: string;
}> {
  try {
    const head = await git('rev-parse', `refs/heads/${syncBranch}`);
    return { exists: true, orphaned: false, head: head.trim() };
  } catch {
    // Check if branch ref exists but is orphaned (no commits)
    try {
      await git('show-ref', '--verify', `refs/heads/${syncBranch}`);
      return { exists: true, orphaned: true };
    } catch {
      return { exists: false, orphaned: false };
    }
  }
}

/**
 * Check remote sync branch health.
 */
export async function checkRemoteBranchHealth(
  remote: string,
  syncBranch: string
): Promise<{
  exists: boolean;
  diverged: boolean;
  head?: string;
}> {
  try {
    await git('fetch', remote, syncBranch);
    const head = await git('rev-parse', `refs/remotes/${remote}/${syncBranch}`);

    // Check for divergence
    const mergeBase = await git('merge-base', syncBranch, `${remote}/${syncBranch}`).catch(() => '');
    const localHead = await git('rev-parse', syncBranch).catch(() => '');
    const remoteHead = head.trim();

    const diverged = mergeBase.trim() !== localHead.trim() &&
                     mergeBase.trim() !== remoteHead;

    return { exists: true, diverged, head: remoteHead };
  } catch {
    return { exists: false, diverged: false };
  }
}

/**
 * Check consistency between worktree, local branch, and remote.
 */
export async function checkSyncConsistency(
  baseDir: string,
  syncBranch: string,
  remote: string
): Promise<{
  worktreeHead: string;
  localHead: string;
  remoteHead: string;
  worktreeMatchesLocal: boolean;
  localAhead: number;
  localBehind: number;
}> {
  const worktreePath = join(baseDir, WORKTREE_DIR);

  const worktreeHead = await git('-C', worktreePath, 'rev-parse', 'HEAD').catch(() => '');
  const localHead = await git('rev-parse', syncBranch).catch(() => '');
  const remoteHead = await git('rev-parse', `${remote}/${syncBranch}`).catch(() => '');

  let localAhead = 0;
  let localBehind = 0;

  if (localHead && remoteHead) {
    const aheadOutput = await git('rev-list', '--count', `${remote}/${syncBranch}..${syncBranch}`).catch(() => '0');
    const behindOutput = await git('rev-list', '--count', `${syncBranch}..${remote}/${syncBranch}`).catch(() => '0');
    localAhead = parseInt(aheadOutput, 10) || 0;
    localBehind = parseInt(behindOutput, 10) || 0;
  }

  return {
    worktreeHead: worktreeHead.trim(),
    localHead: localHead.trim(),
    remoteHead: remoteHead.trim(),
    worktreeMatchesLocal: worktreeHead.trim() === localHead.trim(),
    localAhead,
    localBehind,
  };
}
```

#### 5. Migration Command (migrate-data subcommand or doctor --fix)

For repos with data in the wrong location:

```typescript
async function migrateDataToWorktree(baseDir: string): Promise<void> {
  const wrongPath = join(baseDir, DATA_SYNC_DIR);
  const correctPath = join(baseDir, DATA_SYNC_DIR_VIA_WORKTREE);

  // Ensure worktree exists
  await initWorktree(baseDir);

  // Copy issues from wrong path to correct path
  const issues = await listIssues(wrongPath);
  for (const issue of issues) {
    await writeIssue(correctPath, issue);
  }

  // Copy mappings
  const mappingsWrong = join(wrongPath, 'mappings');
  const mappingsCorrect = join(correctPath, 'mappings');
  await copyDir(mappingsWrong, mappingsCorrect);

  // Commit in worktree
  await git('-C', join(baseDir, WORKTREE_DIR), 'add', '-A');
  await git('-C', join(baseDir, WORKTREE_DIR), 'commit', '-m',
    `tbd: migrate ${issues.length} issues from incorrect location`);

  // Remove wrong path data (after backup confirmation)
  // await rm(wrongPath, { recursive: true });
}
```

### API Changes

**New options:**
- `tbd sync --fix` - Attempt to repair worktree before syncing
- `tbd doctor --fix` - Auto-fix detected issues including worktree

**New errors:**
- `WorktreeMissingError` - Worktree directory doesn’t exist
- `WorktreeCorruptedError` - Worktree exists but is invalid

## Implementation Plan

### Phase 1: Detection and Error Reporting

Add proper detection and clear error messages before any auto-repair.

**Health Check Functions (git.ts):**
- [ ] Add `checkWorktreeHealth()` function - detect missing/prunable/corrupted worktree
- [ ] Add `checkLocalBranchHealth()` function - detect missing/orphaned local tbd-sync
  branch
- [ ] Add `checkRemoteBranchHealth()` function - detect missing/diverged remote branch
- [ ] Add `checkSyncConsistency()` function - compare worktree HEAD, local HEAD, remote
  HEAD

**Doctor Command (doctor.ts):**
- [ ] Add worktree health check to doctor
- [ ] Add local branch health check to doctor
- [ ] Add remote branch health check to doctor
- [ ] Add sync consistency check (worktree matches local, ahead/behind counts)
- [ ] Add data location check (detect issues in wrong .tbd/data-sync/ path)
- [ ] Add “local has data but remote empty” detection (the ai-trade-arena bug)
- [ ] Add multi-user/clone scenario detection:
  - [ ] Beads migration exists but tbd has no issues (User B cloned broken repo)
  - [ ] Config has id_prefix but no issues (suggests lost data)
  - [ ] Active .beads/ directory exists (migration available)

**Sync Command (sync.ts):**
- [ ] Update `tbd sync` to check worktree health before operations
- [ ] Add clear error messages when worktree is unhealthy

**Error Classes:**
- [ ] Add `WorktreeMissingError` class
- [ ] Add `WorktreeCorruptedError` class
- [ ] Add `SyncBranchError` class

**Tests:**
- [ ] Add tests for each health check function
- [ ] Add tests for doctor detecting each issue type
- [ ] Add golden tests for doctor output with various issues

### Phase 2: Path Consistency

Fix the path mismatch bugs in sync.ts.

- [ ] Update `getSyncStatus()` to check worktree status, not main branch
- [ ] Update `commitWorktreeChanges()` to use consistent path with dataSyncDir
- [ ] Remove hardcoded `WORKTREE_DIR` usage in sync operations
- [ ] Ensure `resolveDataSyncDir()` throws when worktree missing (non-test mode)
- [ ] Add tests verifying path consistency

### Phase 3: Auto-Repair

Add automatic worktree repair capabilities.

- [ ] Add `--fix` flag to `tbd sync`
- [ ] Implement repair logic: recreate worktree if missing/prunable
- [ ] Add `--fix` flag to `tbd doctor`
- [ ] Add migration logic for data in wrong location
- [ ] Add confirmation prompt before destructive operations
- [ ] Add tests for repair scenarios

### Phase 4: Prevention

Ensure this bug category cannot recur.

- [ ] Add architectural test: verify issues written to worktree path
- [ ] Add CI check: worktree health after operations
- [ ] Update init/setup to verify worktree after creation
- [ ] Add warning in resolveDataSyncDir when falling back (test mode only)
- [ ] Document worktree architecture in developer docs

## Testing Strategy

### Unit Tests

- `checkWorktreeHealth()` with various worktree states
- `resolveDataSyncDir()` with and without worktree
- Error classes and messages

### Integration Tests

- Sync with missing worktree → error
- Sync with prunable worktree → error
- `tbd sync --fix` recreates worktree
- `tbd doctor` detects issues in wrong location
- `tbd doctor --fix` migrates data

### Golden Tests

- Error output for missing worktree
- Doctor output with worktree issues
- Successful repair output

### Architectural Tests

```typescript
it('never writes issues to .tbd/data-sync/ in production', async () => {
  await run('tbd init');
  await run('tbd create "Test"');

  expect(await exists('.tbd/data-sync/issues/')).toBe(false);
  expect(await exists('.tbd/data-sync-worktree/.tbd/data-sync/issues/')).toBe(true);
});
```

## Rollout Plan

1. **Immediate**: Document the bug and workaround for affected users
2. **Phase 1**: Release with detection - users see errors instead of silent failure
3. **Phase 2-3**: Release with --fix capabilities
4. **Phase 4**: Add prevention tests to CI

## Open Questions

1. Should `tbd sync` auto-repair by default, or require `--fix` flag?
   - Recommendation: Require `--fix` to make behavior explicit

2. Should we keep the direct path fallback for any scenario?
   - Recommendation: Only for tests with explicit `allowFallback: true`

3. How to handle the backup before migration?
   - Recommendation: Always backup to Attic/ before migrating, require confirmation

4. Should `resolveDataSyncDir` be sync or async?
   - Currently async (does fs.access), keep as-is

## References

- Postmortem:
  [retro-2026-01-16-worktree-architecture-not-implemented.md](../../retrospectives/retro-2026-01-16-worktree-architecture-not-implemented.md)
- Design spec: [tbd-design.md](../../../packages/tbd/docs/tbd-design.md) §2.3 Hidden
  Worktree Model
- Related issues: tbd-1810, tbd-208

## Appendix A: What Doctor Would Report for ai-trade-arena

With the spec implemented, `tbd doctor` would output:

```
Checking tbd health...

✗ ERROR: Worktree is prunable
  Fix: Run `tbd doctor --fix` to repair

✗ ERROR: Found 951 issues in wrong location (.tbd/data-sync/)
  Fix: Run `tbd doctor --fix` to migrate to worktree

✗ ERROR: Remote 'tbd-sync' has no issues - the 951 local issues were never synced
  Fix: Run `tbd doctor --fix` to repair worktree and migrate data, then `tbd sync`

3 error(s), 0 warning(s), 0 info(s)

Run `tbd doctor --fix` to auto-fix 2 issue(s)
```

After `tbd doctor --fix`:

```
Repairing tbd...

✓ Pruned stale worktree entry
✓ Created worktree at .tbd/data-sync-worktree
✓ Backed up 951 issues to Attic/tbd-data-sync-backup-20260128-HHMMSS/
✓ Migrated 951 issues to worktree
✓ Committed migration to tbd-sync branch

Run `tbd sync` to push changes to remote.
```

### What User B Would See (After Cloning Broken Repo)

If another user clones ai-trade-arena before the issues are synced, `tbd doctor` would
show:

```
Checking tbd health...

✗ ERROR: Beads migration exists with 721 issues, but tbd has none
  This repo was migrated from beads but issues were never synced to remote.
  Another user may have the issues locally but they were not pushed.
  Fix: Contact the repo owner to run `tbd sync` and push their local issues

⚠ WARNING: Config has id_prefix 'ar' but no issues exist
  This suggests issues may have been created but not synced,
  or were lost due to sync issues on another machine.
  Fix: If you expect issues to exist, contact the repo owner

1 error(s), 1 warning(s), 0 info(s)
```

This gives User B a clear explanation of why they see no issues despite evidence (beads
migration, configured id_prefix) that issues should exist.

## Appendix B: What Doctor Would Report for markform (Never Initialized)

For repos where the worktree was never created and no branches exist:

```
Checking tbd health...

✗ ERROR: Worktree is missing
  Fix: Run `tbd doctor --fix` to repair

✗ ERROR: Local branch 'tbd-sync' does not exist
  Fix: Run `tbd doctor --fix` to create from remote or initialize

⚠ WARNING: Remote branch 'origin/tbd-sync' does not exist
  Fix: Run `tbd sync` to push local branch to remote

✗ ERROR: Found 8 issues in wrong location (.tbd/data-sync/)
  Fix: Run `tbd doctor --fix` to migrate to worktree

3 error(s), 1 warning(s), 0 info(s)
```

After `tbd doctor --fix`:

```
Repairing tbd...

✓ Created orphan branch 'tbd-sync'
✓ Created worktree at .tbd/data-sync-worktree
✓ Backed up 8 issues to Attic/tbd-data-sync-backup-YYYYMMDD-HHMMSS/
✓ Migrated 8 issues to worktree
✓ Committed migration to tbd-sync branch

Run `tbd sync` to push changes to remote.
```

**Key difference from ai-trade-arena:** No “prune” step needed because there’s no stale
worktree entry in git.
Instead, we create the branch from scratch as an orphan.

## Appendix C: What Doctor Would Report for lexikon-site (Never Pushed)

For repos where everything local is correct but remote branch doesn’t exist:

```
Checking tbd health...

⚠ WARNING: Remote branch 'origin/tbd-sync' does not exist
  Fix: Run `tbd sync` to push local branch to remote

ℹ INFO: Local 'tbd-sync' has commits that are not on remote
  Fix: Run `tbd sync` to push changes

0 error(s), 1 warning(s), 1 info(s)
```

No `--fix` needed - just run `tbd sync` to push.

## Appendix D: Doctor --fix Decision Tree

The `tbd doctor --fix` command follows this decision tree:

```
START
  │
  ├─► Check worktree status
  │   ├─► HEALTHY → skip to step 4
  │   ├─► PRUNABLE → (1) git worktree prune
  │   └─► MISSING → continue
  │
  ├─► Check local branch
  │   ├─► EXISTS → (2) git worktree add .tbd/data-sync-worktree tbd-sync
  │   └─► MISSING → Check remote branch
  │       ├─► EXISTS → (2a) git fetch && git worktree add ... origin/tbd-sync
  │       └─► MISSING → (2b) git worktree add --orphan tbd-sync ...
  │
  ├─► Check wrong location (.tbd/data-sync/)
  │   ├─► HAS DATA →
  │   │   ├─► (3) Backup to Attic/tbd-data-sync-backup-YYYYMMDD-HHMMSS/
  │   │   ├─► (4) Copy to .tbd/data-sync-worktree/.tbd/data-sync/
  │   │   ├─► (5) git -C worktree add -A && git commit
  │   │   └─► (6) Remove wrong location data (optional, with confirmation)
  │   └─► EMPTY → skip migration
  │
  └─► Done - remind user to run `tbd sync`
```

**Failure mode mapping:**

| Failure Mode | Steps Executed |
| --- | --- |
| ai-trade-arena (prunable) | 1, 2, 3, 4, 5, 6 |
| markform (never initialized) | 2b, 3, 4, 5, 6 |
| lexikon-site (never pushed) | None (no --fix needed) |

## Appendix E: Manual Recovery Steps for ai-trade-arena

If manual recovery is needed (or before `tbd doctor --fix` is implemented):

```bash
# 0. Verify current state
cd /Users/levy/wrk/aisw/ai-trade-arena
git worktree list --porcelain | grep -A3 data-sync-worktree
# Should show: prunable gitdir file points to non-existent location

# 1. Backup (already done)
# Data backed up to: Attic/tbd-data-sync-backup-20260128-142024/

# 2. Prune the stale worktree entry from git's tracking
git worktree prune
# This removes .git/worktrees/data-sync-worktree/ entry

# 3. Recreate the worktree from existing tbd-sync branch
git worktree add .tbd/data-sync-worktree tbd-sync
# This creates:
#   .tbd/data-sync-worktree/.git (file pointing to main repo)
#   .tbd/data-sync-worktree/.tbd/data-sync/issues/.gitkeep
#   .tbd/data-sync-worktree/.tbd/data-sync/mappings/.gitkeep
#   .tbd/data-sync-worktree/.tbd/data-sync/meta.yml

# 4. Copy issues from wrong location to correct location
cp -R .tbd/data-sync/issues/* .tbd/data-sync-worktree/.tbd/data-sync/issues/
cp -R .tbd/data-sync/mappings/* .tbd/data-sync-worktree/.tbd/data-sync/mappings/

# 5. Commit the recovery in the worktree
git -C .tbd/data-sync-worktree add -A
git -C .tbd/data-sync-worktree commit -m "tbd: recover 951 issues from incorrect location

Issues were incorrectly written to .tbd/data-sync/ on main branch
instead of .tbd/data-sync-worktree/.tbd/data-sync/ on tbd-sync branch.
This was caused by missing worktree directory."

# 6. Push to remote
git push origin tbd-sync

# 7. Verify
tbd sync --status
# Should show: Repository is in sync

tbd stats
# Should show: 951 issues

# 8. (Optional) Remove wrong-location data after confirming recovery
# rm -rf .tbd/data-sync/issues .tbd/data-sync/mappings
# Keep .tbd/data-sync/.gitkeep if it exists
```

## Appendix F: Root Cause Summary

**Why did this happen?**

1. Worktree was created on Jan 17 during `tbd init`
2. At some point, `.tbd/data-sync-worktree/` directory was deleted (cause unknown)
3. Git still tracked the worktree but marked it “prunable”
4. `resolveDataSyncDir()` checked if worktree path exists → NO → fell back to
   `.tbd/data-sync/`
5. All subsequent operations wrote to the fallback path
6. `tbd sync` tried to commit from worktree path → directory missing → nothing to commit
7. `tbd sync` compared local/remote branch commits → same → “Already in sync”
8. 951 issues accumulated in wrong location, never synced

**Why wasn’t this detected?**

1. No health check for worktree before sync operations
2. Silent fallback in `resolveDataSyncDir()` - no warning or error
3. `getSyncStatus()` checked git status on gitignored path (always empty)
4. No check for “local has data but remote is empty”
