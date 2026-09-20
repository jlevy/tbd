---
type: is
id: is-01m2y5cnk0q9a0pdaqb37jkvmq
title: "PR #309 J3: Correct trusted-default fetch in review workflow"
kind: bug
status: in_progress
priority: 2
version: 2
delegate: codex@spud10
labels: []
dependencies: []
parent_id: is-01m2y4ygvt317renehn2caprwa
hold: null
hold_until: null
created_at: 2026-09-20T01:02:49.950Z
updated_at: 2026-09-20T01:07:19.364Z
started_at: 2026-09-20T01:07:19.362Z
---
Review J. review-and-merge-prs.md:82 turns origin/HEAD into origin/main and fetches wrong remote name. Require verified full ref and explicit fetch destination.
