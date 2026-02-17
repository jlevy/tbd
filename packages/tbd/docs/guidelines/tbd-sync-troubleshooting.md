---
title: tbd Sync and Workspace Troubleshooting
description: Common issues and solutions for tbd sync and workspace operations
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
## Common Sync Issues

### Push Fails with HTTP 403

**Symptoms:**
- `tbd sync` reports HTTP 403 error
- Local commits exist but aren’t pushed to remote

**Causes:**
- Branch restrictions (e.g., Claude Code session branch requirements)
- Push permissions not granted for tbd-sync branch

**Automatic Recovery (Default):** tbd now automatically saves to outbox on permanent
failures like HTTP 403:
```bash
tbd sync
# ⚠️  Push failed: HTTP 403
# ✓ Saved 2 issue(s) to outbox (automatic backup)
```

**Solutions:**
1. ~~Save unsynced work: `tbd save --outbox`~~ (now automatic)
2. Commit outbox to working branch:
   `git add .tbd/workspaces && git commit -m "tbd: save outbox"`
3. Push working branch (which typically succeeds)
4. Import happens automatically when you later run `tbd sync` in an environment that can
   push

### “Already in sync” but data not on remote

**Symptoms:**
- `tbd sync` says “Already in sync”
- Checking remote shows data is missing

**Causes:**
- Previous push silently failed
- Local branch is ahead of remote but error was missed

**Solutions:**
1. Run `tbd sync --status` to check actual state
2. Check `git log tbd-sync --oneline` vs `git log origin/tbd-sync --oneline`
3. If local is ahead, push manually: `git push origin tbd-sync`
4. If that fails, use workspace recovery workflow

### Network Timeouts

**Symptoms:**
- `tbd sync` hangs or times out
- “Connection refused” or timeout errors

**Note:** Network errors are classified as “transient” - tbd suggests retry instead of
auto-saving, since the issue is likely temporary.

**Solutions:**
1. Check network connectivity
2. Verify remote URL: `git remote -v`
3. Retry: `tbd sync`
4. If persistent, manually save: `tbd save --workspace=offline-backup`

### Bulk Trivial Changes in Outbox (Version/Timestamp Only)

**Symptoms:**
- Outbox contains hundreds or thousands of issues
- `git diff` shows only `updated_at` and `version` changes, no real content changes
- Sync commit shows thousands of files changed

**Causes (fixed in v0.1.21+):**
- The merge algorithm previously bumped `version` and `updated_at` on every merged
  issue, even when the merge produced no substantive content change
- The outbox save compared issues using full equality (including version/timestamp),
  treating all merged issues as “modified”
- When network was down, the outbox fallback saved ALL issues instead of using cached
  remote state

**What tbd now does:**
- `mergeIssues()` detects no-op merges and skips the version/timestamp bump
- `getUpdatedIssues()` ignores `version` and `updated_at` when filtering — only issues
  with actual content changes (title, status, labels, description, etc.)
  are saved
- When fetch fails, the cached `origin/tbd-sync` ref is used for comparison instead of
  falling back to saving all issues

**If you encounter this with an older version:**
1. Update tbd: `npm install -g get-tbd@latest`
2. If you already have a large outbox, you can safely import it — the import will merge
   using field-level LWW and the trivial changes will be harmless
3. Run `tbd sync` to clear the outbox

## Workspace Issues

### Don’t gitignore .tbd/workspaces/

When `tbd sync` fails and auto-saves to `.tbd/workspaces/outbox/`, a new untracked
directory appears. Do not add it to `.gitignore` — the outbox must be committed to your
working branch so unsynced data survives across sessions.

**What to do instead:**
```bash
git add .tbd/workspaces
git commit -m "tbd: save outbox"
git push
```

If `.tbd/workspaces/` is gitignored, unsynced issues are silently discarded on checkout
and permanently lost.
The `.tbd/.gitignore` file contains a `!workspaces/` negation pattern to prevent this.

### Workspace not showing in status

**Symptoms:**
- `tbd status` doesn’t show expected workspaces
- `tbd workspace list` returns empty

**Causes:**
- Workspace directory doesn’t exist
- Workspace directory is not a valid directory

**Solutions:**
1. Check directory exists: `ls .tbd/workspaces/`
2. Ensure workspace was created: `tbd save --workspace=test`
3. Verify workspace structure: `ls .tbd/workspaces/test/`

### Import conflicts

**Symptoms:**
- `tbd import` reports conflicts
- Expected data not in worktree

**Causes:**
- Same issue edited in both workspace and worktree
- Conflicting changes at field level

**Solutions:**
1. Check attic for conflict details: `ls .tbd/data-sync-worktree/.tbd/data-sync/attic/`
2. Review conflict files to understand what was lost
3. Manually merge if needed
4. Re-import with fresh workspace if appropriate

### Workspace not committed

**Symptoms:**
- Workspace data lost after checkout
- `git status` shows untracked .tbd/workspaces/

**Causes:**
- Workspace was saved but not committed to git

**Solutions:**
1. Always commit after save:
   `git add .tbd/workspaces && git commit -m "tbd: save workspace"`
2. Set up git hooks to remind about uncommitted workspaces
3. Check `git status` before switching branches

## Worktree Issues

### Worktree corrupted

**Symptoms:**
- `tbd doctor` reports worktree problems
- Commands fail with worktree errors

**Solutions:**
1. Run `tbd doctor --fix` to auto-repair
2. If that fails, manually repair:
   ```bash
   rm -rf .tbd/data-sync-worktree
   git worktree prune
   tbd doctor --fix
   ```
3. Save work to workspace before repair if needed

### Worktree shows “detached HEAD”

**Symptoms:**
- `git -C .tbd/data-sync-worktree status` shows detached HEAD
- Commits not going to tbd-sync branch

**Solutions:**
1. Run `tbd doctor --fix` to repair
2. This recreates worktree on proper branch

## Diagnostic Commands

```bash
# Check overall health
tbd doctor

# Check sync status without syncing
tbd sync --status

# List workspaces
tbd workspace list

# View worktree branch
git -C .tbd/data-sync-worktree branch

# Compare local vs remote
git log tbd-sync --oneline -5
git log origin/tbd-sync --oneline -5

# Check for unpushed commits
git log origin/tbd-sync..tbd-sync --oneline
```

## Recovery Workflow Summary

When sync fails with a permanent error (HTTP 403, permission denied, etc.):

```bash
# 1. Run sync - auto-saves to outbox on permanent failure
tbd sync
# ⚠️  Push failed: HTTP 403
# ✓ Saved 2 issue(s) to outbox (automatic backup)

# 2. Commit outbox to working branch
git add .tbd/workspaces && git commit -m "tbd: save outbox"
git push

# 3. Later (in environment where sync works), just run sync
tbd sync
# ✓ Imported 2 issue(s) from outbox (also synced)
```

**CLI Options:**
- `--no-auto-save`: Skip automatic save to outbox on failure
- `--no-outbox`: Skip automatic import from outbox on success

See `tbd shortcut sync-failure-recovery` for the full workflow.
