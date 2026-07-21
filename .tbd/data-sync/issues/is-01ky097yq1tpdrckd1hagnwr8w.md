---
type: is
id: is-01ky097yq1tpdrckd1hagnwr8w
title: "S3: Add actionable missing sync-tip guidance"
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
created_at: 2026-07-20T17:30:09.504Z
updated_at: 2026-07-20T18:23:25.797Z
closed_at: 2026-07-20T18:23:25.797Z
close_reason: "Addressed in the PR #196 post-review hardening commit; focused tests, full Vitest coverage, precommit, publint, and package-age gates pass."
---
When changes/watch cannot resolve a local sync-branch tip in a fresh clone, tell the user to run tbd sync first.
