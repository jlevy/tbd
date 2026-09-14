---
type: is
id: is-01m26cmagk7vpeq8k3z1d9rm9a
title: Abort corrupted-worktree repair when backup fails
kind: bug
status: open
priority: 0
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-10T19:27:34.413Z
updated_at: 2026-09-14T04:31:00.683Z
---
repairCorruptedWorktree catches backup copy failures, recursively removes the worktree anyway, and reports a backup path that may not exist. Fail closed before removal unless durable backup succeeds, with a forced-copy-failure regression. Treat as a release safety blocker.

## Notes

Verified still live on main at 52d5c2f7 (2026-09-14 release-readiness pass). file/git.ts:2989-2993: the cp() into .tbd/backups/ is wrapped in a bare 'catch {}' whose comment says 'Continue with repair anyway', then :2997 runs rm(worktreePath, {recursive:true, force:true}) unconditionally and :3002 returns { backedUp: backupPath } naming a path that may not exist. The caller is therefore told a backup exists when it does not. A corrupted data-sync worktree can hold unsynced bead work, so this is unrecoverable loss, not churn. Now wired as a blocker of the release gate tbd-lz1q.
