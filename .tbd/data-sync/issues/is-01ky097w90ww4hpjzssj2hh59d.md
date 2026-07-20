---
type: is
id: is-01ky097w90ww4hpjzssj2hh59d
title: "R2: Reclaim orphaned private watch refs after interruption"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - pr-review
  - github-196
dependencies: []
parent_id: is-01ky0976vg9em86ra5ad9myh4c
created_at: 2026-07-20T17:30:07.007Z
updated_at: 2026-07-20T18:23:25.746Z
closed_at: 2026-07-20T18:23:25.746Z
close_reason: "Addressed in the PR #196 post-review hardening commit; focused tests, full Vitest coverage, precommit, publint, and package-age gates pass."
---
Prevent SIGINT or abrupt termination from permanently leaving refs/tbd/watch/<pid>-<uuid> refs that pin fetched objects; align the changelog claim with the implemented lifecycle.
