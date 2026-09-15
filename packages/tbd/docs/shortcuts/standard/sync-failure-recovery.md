---
title: Sync Failure Recovery
description: Handle tbd sync failures by saving to workspace and recovering later
category: session
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
When `tbd sync` fails to push (e.g., permission issues, branch restrictions), tbd
automatically handles recovery in most cases.

## Automatic Recovery (Default Behavior)

**On permanent failure (HTTP 403, permission denied, etc.):**
- tbd automatically saves unsynced issues to the outbox
- You just need to commit and push your working branch

**On successful sync:**
- tbd automatically imports any pending issues from the outbox
- The outbox is cleared after successful sync

## When Sync Fails (Typical Workflow)

```bash
# Run sync - auto-saves to outbox on permanent failure
tbd sync
# ⚠️  Push failed: HTTP 403
# ✓ Saved 2 issue(s) to outbox (automatic backup)

# Commit the outbox to your working branch
git add .tbd/workspaces
git commit -m "tbd: save outbox"
git push
```

**Note:** Do not gitignore `.tbd/workspaces/`; it must be committed to your working
branch.

## Later, When Sync Works

In a new session or environment where sync works:

```bash
# Just run sync - outbox is imported automatically on success
tbd sync
# ✓ Synced: sent 0 new
# ✓ Imported 2 issue(s) from outbox (also synced)
```

## Manual Recovery (Optional)

If you need explicit control over the workflow:

```bash
# Manually save to outbox (skip auto-save)
tbd sync --no-auto-save
tbd save --outbox

# Manually import from outbox (skip auto-import)
tbd sync --no-outbox
tbd import --outbox
tbd sync
```

## Recovering a Value a Merge Discarded

A sync that reports `N conflicts resolved, archived in the attic` kept one side of a
field and discarded the other.
The discarded value is in the attic, not only in git history, and it reached every clone
along with the merge.

```bash
# What was discarded, newest first
tbd attic list
tbd attic list proj-a7k2            # just this issue

# What the entry holds
tbd attic show proj-a7k2 2026-01-15T10:30:00Z

# Put a discarded title, description or notes back
tbd attic restore proj-a7k2 2026-01-15T10:30:00Z
```

`restore` archives the value it replaces before overwriting, so it is itself undoable.
For a structured field such as `extensions.<provider>` it will refuse; use
`tbd attic show` and reapply by hand.

## More Information

For detailed troubleshooting, workspace usage, and diagnostic commands, see:

```bash
tbd guidelines tbd-sync-troubleshooting
```

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
