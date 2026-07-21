---
type: is
id: is-01ky097xp50mbfc76wede183ax
title: "R6: Preserve empty --spec filter compatibility"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - pr-review
  - github-196
dependencies: []
parent_id: is-01ky0976vg9em86ra5ad9myh4c
created_at: 2026-07-20T17:30:08.452Z
updated_at: 2026-07-20T18:23:25.781Z
closed_at: 2026-07-20T18:23:25.781Z
close_reason: "Addressed in the PR #196 post-review hardening commit; focused tests, full Vitest coverage, precommit, publint, and package-age gates pass."
---
Treat an explicit empty --spec value as absent, matching list's prior truthiness behavior, or reject it consistently.
