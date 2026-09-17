---
type: is
id: is-01m2rk0sz842g81q3tq7za62hr
title: "PR #307 B1: repair skips the writer readiness gate and runs before the worktree checks"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels: []
dependencies: []
parent_id: is-01m2rk07a26hew8fzbz8njv6r4
hold: null
hold_until: null
created_at: 2026-09-17T21:05:34.695Z
updated_at: 2026-09-17T21:47:11.323Z
started_at: 2026-09-17T21:46:46.263Z
closed_at: 2026-09-17T21:47:11.318Z
close_reason: "fixed in 16df8995 (option 1 of the two offered): the repair runs through withDataSyncContext with the lock, so the readiness gate refuses a corrupted worktree or a newer-format store and the finding reports the edges as still pending instead of claiming a removal. tbd-design.md step 6 and tbd-docs.md updated. Confirmed by the corrupted-worktree and newer-tbd tests."
resolution: null
duplicate_of: null
---
Medium. doctor.ts:469-473, :1010-1035. The repair uses the bare withSharedDataSyncLock instead of withDataSyncContext/prepareDataSyncContext, and runs as check 4, before Worktree (9) and Common-dir layout (9b); tbd-design.md:4104-4124 documents orphan removal as --fix step 6. Reproduced: (a) detached worktree reports a repair that repairWorktree then discards; (b) a future tbd_format store is rewritten although dep remove refuses. Review B: https://github.com/jlevy/tbd/pull/307#pullrequestreview-5241384146
