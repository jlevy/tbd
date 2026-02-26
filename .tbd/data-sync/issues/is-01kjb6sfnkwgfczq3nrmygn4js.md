---
type: is
id: is-01kjb6sfnkwgfczq3nrmygn4js
title: Add linked-worktree regression tests for sync branch isolation
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-02-25-multi-worktree-sync-branch-isolation.md
labels: []
dependencies: []
parent_id: is-01kjb6s8sc4b9cveaamzeasdxa
created_at: 2026-02-25T20:10:35.058Z
updated_at: 2026-02-26T06:38:49.183Z
closed_at: 2026-02-26T06:38:49.183Z
close_reason: Added regression coverage for split sync refs and linked worktrees (new sync-branch tests, updated git/worktree tests, and tryscript scenarios).
---
Add unit and e2e tests covering multiple linked outer checkouts, concurrent sync, push failures/outbox recovery, and single-checkout backward compatibility.
