---
type: is
id: is-01m2y5e5fnpwctz06pdt5jqtnx
title: "PR #309 K3: Refuse policy writes through AGENTS.md symlinks"
kind: bug
status: in_progress
priority: 1
version: 2
delegate: fix_309_policy
labels: []
dependencies: []
parent_id: is-01m2y4ygvt317renehn2caprwa
hold: null
hold_until: null
created_at: 2026-09-20T01:03:38.996Z
updated_at: 2026-09-20T01:06:56.034Z
started_at: 2026-09-20T01:06:56.034Z
---
Review K. policy grant follows symlinks via atomically and changes outside files. Refuse nonregular or symlink destination for policy and setup paths; preserve external content.
