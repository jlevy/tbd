---
type: is
id: is-01m2y5e7e9979hzb6rc3ebynft
title: "PR #309 K6: Validate actual policy write before dry-run success"
kind: bug
status: in_progress
priority: 3
version: 2
delegate: fix_309_policy
labels: []
dependencies: []
parent_id: is-01m2y4ygvt317renehn2caprwa
hold: null
hold_until: null
created_at: 2026-09-20T01:03:41.000Z
updated_at: 2026-09-20T01:06:56.051Z
started_at: 2026-09-20T01:06:56.051Z
---
Review K. policy dry-run returns before withPolicyBlock validates missing integration block. Compute and validate intended write before dry-run, physical write after.
