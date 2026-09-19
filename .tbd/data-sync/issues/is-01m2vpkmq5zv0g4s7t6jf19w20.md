---
type: is
id: is-01m2vpkmq5zv0g4s7t6jf19w20
title: Tighten review-and-merge-prs step 2 to verify tbd:review markers on the actual channel
kind: task
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2vpkdg97d38s5hqjf79yt20
created_at: 2026-09-19T02:06:00.933Z
updated_at: 2026-09-19T02:06:00.933Z
---
Process improvement, not a stack-312 code-review reopen. Step 2 currently queries only POST /reviews. F was claimed published but lived only in a worktree file. Require the coordinator to sweep issue comments (and the reported channel) for the exact marker before starting the next review. Add a contract-test phrase if the written step stays underspecified. Do not implement in this planning session.
