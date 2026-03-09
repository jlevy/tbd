---
close_reason: Implemented --long flag in list, ready, and blocked commands with formatIssueLong support
closed_at: 2026-01-18T05:33:02.094Z
created_at: 2026-01-18T04:08:23.490Z
dependencies:
  - target: is-01kf7mmy2wq0qgmaxj55vtsvsc
    type: blocks
id: is-01kf7mmb636x6ppr9pb3d89d4v
kind: task
labels: []
priority: 2
status: closed
title: Add --long flag to commands
type: is
updated_at: 2026-03-09T16:12:31.585Z
version: 10
---
Add --long flag for showing descriptions:
- Add --long flag to list command
- Add --long flag to ready command
- Add --long flag to blocked command
- Ensure --long works with --pretty tree view (proper indentation)

Reference: plan spec section 2.4 (Long Format)
