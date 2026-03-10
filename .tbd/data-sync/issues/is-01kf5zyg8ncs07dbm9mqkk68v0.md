---
type: is
id: is-01kf5zyg8ncs07dbm9mqkk68v0
title: "Add test helper: verify file location after operations"
kind: task
status: closed
priority: 1
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T18:46:36.556Z
updated_at: 2026-03-09T16:12:30.256Z
closed_at: 2026-01-16T18:54:29.894Z
close_reason: "Added file location helpers: isCorrectWorktreePath, isWrongMainBranchPath"
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.397Z
    original_id: tbd-1837
---
Create test helper function that checks WHERE files are written (worktree vs main). Used to catch bugs like tbd-1810.
