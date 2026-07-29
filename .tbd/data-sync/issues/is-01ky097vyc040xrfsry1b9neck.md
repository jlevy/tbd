---
type: is
id: is-01ky097vyc040xrfsry1b9neck
title: "R1: Validate --bead IDs before watch polling"
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
created_at: 2026-07-20T17:30:06.667Z
updated_at: 2026-07-20T18:23:25.736Z
closed_at: 2026-07-20T18:23:25.735Z
close_reason: "Addressed in the PR #196 post-review hardening commit; focused tests, full Vitest coverage, precommit, publint, and package-age gates pass."
---
Reject unknown --bead IDs before entering an indefinite watch loop while retaining report-time validation against each authoritative snapshot.
