---
type: is
id: is-01m2y5e3sd3z1wx825vx3qn6f2
title: "PR #309 K2: Reject grants hidden by Markdown fence boundaries"
kind: bug
status: in_progress
priority: 2
version: 2
delegate: fix_309_policy
labels: []
dependencies: []
parent_id: is-01m2y4ygvt317renehn2caprwa
hold: null
hold_until: null
created_at: 2026-09-20T01:03:37.260Z
updated_at: 2026-09-20T01:06:56.022Z
started_at: 2026-09-20T01:06:56.022Z
---
Review K. Preserve fence delimiter/length and full-document comment/fence state, including policy marker locations. Reject grants inside mismatched/shorter fences and outer hidden blocks.
