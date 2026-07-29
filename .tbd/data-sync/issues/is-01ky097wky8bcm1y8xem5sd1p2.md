---
type: is
id: is-01ky097wky8bcm1y8xem5sd1p2
title: "R3: Batch sync snapshot object reads"
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - pr-review
  - github-196
dependencies: []
parent_id: is-01ky0976vg9em86ra5ad9myh4c
created_at: 2026-07-20T17:30:07.357Z
updated_at: 2026-07-20T18:23:25.754Z
closed_at: 2026-07-20T18:23:25.754Z
close_reason: "Addressed in the PR #196 post-review hardening commit; focused tests, full Vitest coverage, precommit, publint, and package-age gates pass."
---
Replace per-issue git show subprocesses in changes/watch snapshot reads with a bounded batched Git plumbing operation and retain strict snapshot validation.
