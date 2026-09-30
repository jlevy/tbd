---
type: is
id: is-01m2kfdv49hpc2jytb1s0y02hx
title: Automatic repair of a prunable data-sync worktree may delete it without a backup (tbd-dmkd class)
kind: bug
status: in_progress
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: claude-code@spud10.local
labels: []
dependencies:
  - type: blocks
    target: is-01m3rkx8y1t5z3kbnxjsc89nqf
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
hold: null
hold_until: null
created_at: 2026-09-15T21:26:35.400Z
updated_at: 2026-09-30T07:40:07.176Z
started_at: 2026-09-30T07:40:06.469Z
---
Same failure class as tbd-dmkd (fixed in #287), on a path that fix did not cover. Pre-existing. Inferred from code by the 2026-09-15 release-readiness review of main @ 1238038e; the git behaviour was not run, so reproduce first.

If the shared data-sync worktree's `.git` file is missing, git lists the worktree as prunable. `cli/lib/data-context.ts` (~:141-147) then repairs it automatically, and `initWorktree` removes the directory (file/git.ts ~:2240-2244) without the backup that the corrupted-worktree branch now requires (git.ts ~:3099-3110). Unsynced bead files in that directory would be lost silently.

Red test first: a worktree holding an uncommitted bead file, its `.git` file deleted, then any tbd command; assert the bead survives or a backup exists before removal, and that the command refuses when the backup fails. Fix by routing the prunable case through the same backup-then-remove path as the corrupted case.
