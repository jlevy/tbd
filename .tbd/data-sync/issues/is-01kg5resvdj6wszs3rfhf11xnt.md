---
close_reason: "Fixed: sync now properly reports push failures instead of saying 'Already in sync'. Shows HTTP error code, unpushed commit count, and retry instructions."
closed_at: 2026-01-29T21:00:09.566Z
created_at: 2026-01-29T20:52:29.163Z
dependencies: []
id: is-01kg5resvdj6wszs3rfhf11xnt
kind: bug
labels: []
priority: 0
status: closed
title: tbd sync silently swallows push failures and reports 'Already in sync'
type: is
updated_at: 2026-01-29T21:00:09.567Z
version: 4
---
## Problem

When `tbd sync` fails to push (e.g., due to HTTP 403 permission error), it:
1. Silently swallows the error (only logs to debug)
2. Reports "Already in sync" to the user
3. Leaves commits unpushed with no user-visible indication

This is a critical bug because users believe their data is synced when it's not.

## Steps to Reproduce

1. Have commits on local tbd-sync branch that are ahead of remote
2. Have push fail (e.g., due to permissions, network, or 403 error)
3. Run `tbd sync`
4. Observe: "Already in sync" message
5. Run `tbd sync --status` → shows "1 commit(s) ahead (to push)"

## Root Cause

In `sync.ts` `fullSync()` method (lines 660-674):

```typescript
if (aheadCommits > 0) {
  const result = await this.doPushWithRetry(syncBranch, remote);
  if (!result.success) {
    this.output.debug(`Push failed: ${result.error}`);  // Only debug!
  }
}
```

Then lines 679-685 check if `summaryText` is empty to report "Already in sync" without checking if push succeeded.

## Fix

1. Track push success/failure state
2. If push fails with commits still ahead, throw an error or show a warning
3. Never say "Already in sync" if push failed

## Files to Modify

- `packages/tbd/src/cli/commands/sync.ts`: Fix error handling in fullSync()
