---
type: is
id: is-01kf7mmb636x6ppr9pb3d89d4v
title: Add --long flag to commands
kind: task
status: closed
priority: 2
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kf7mmy2wq0qgmaxj55vtsvsc
created_at: 2026-01-18T04:08:23.490Z
updated_at: 2026-03-09T16:12:31.585Z
closed_at: 2026-01-18T05:33:02.094Z
close_reason: Implemented --long flag in list, ready, and blocked commands with formatIssueLong support
---
Add --long flag for showing descriptions:
- Add --long flag to list command
- Add --long flag to ready command
- Add --long flag to blocked command
- Ensure --long works with --pretty tree view (proper indentation)

Reference: plan spec section 2.4 (Long Format)
