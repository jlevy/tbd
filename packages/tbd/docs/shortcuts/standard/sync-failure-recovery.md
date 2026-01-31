---
title: Sync Failure Recovery
description: Handle tbd sync failures by saving to workspace and recovering later
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
When `tbd sync` fails to push (e.g., network errors, permission issues, branch
restrictions), use this workflow to preserve and recover issue data.

## Workflow

### 1. When sync fails

If `tbd sync` fails with a push error:

```bash
# Save unsynced changes to the outbox
tbd save --outbox

# Commit the outbox to your working branch
git add .tbd/workspaces
git commit -m "tbd: save outbox"
git push
```

The `--outbox` flag saves only issues modified since the last successful sync.

### 2. Later, when sync works

In a new session or environment where sync works:

```bash
# Import from outbox (clears outbox on success)
tbd import --outbox

# Sync to push changes
tbd sync
```

## Understanding Workspaces

Workspaces are directories under `.tbd/workspaces/` that store issue backups.

- `tbd save --outbox` saves to `.tbd/workspaces/outbox/`
- `tbd import --outbox` imports from outbox and clears it on success
- Workspaces are committed to your working branch (not gitignored)

## Alternative: Named Workspaces

For backups or bulk editing, use named workspaces:

```bash
# Create a backup
tbd save --workspace=backup-2026-01

# Save to arbitrary directory
tbd save --dir=/tmp/issues-backup

# Import from named workspace
tbd import --workspace=backup-2026-01
```

## Checking Workspace Status

```bash
# List all workspaces
tbd workspace list

# See workspaces in tbd status output
tbd status
```

## Multi-Agent Scenarios

Multiple agents can save to the same outbox:

- Different issues: No conflicts, all preserved
- Same issue edited compatibly: Merged automatically
- Same issue with conflicts: Conflict goes to attic for review

## Troubleshooting

If sync continues to fail:

1. Check network connectivity
2. Verify push permissions: `git push --dry-run origin tbd-sync`
3. Check for branch restrictions in your environment
4. Review error message from `tbd sync` for specific guidance
