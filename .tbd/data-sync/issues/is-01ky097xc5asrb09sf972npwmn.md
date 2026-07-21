---
type: is
id: is-01ky097xc5asrb09sf972npwmn
title: "R5: Omit null-to-null deltas for created and deleted beads"
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
created_at: 2026-07-20T17:30:08.132Z
updated_at: 2026-07-20T18:23:25.773Z
closed_at: 2026-07-20T18:23:25.773Z
close_reason: "Addressed in the PR #196 post-review hardening commit; focused tests, full Vitest coverage, precommit, publint, and package-age gates pass."
---
Do not report normative fields whose before and after values both normalize to null for created or deleted issues.
