---
type: is
id: is-01kzwvyqzq6d8br4tsp3btcc93
title: "PR #209 review SG1: Make setControls await its generation"
kind: bug
status: open
priority: 2
version: 2
labels:
  - review
  - web
  - followup
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:36.566Z
updated_at: 2026-08-13T06:29:37.530Z
---
PR #209 senior review suggestion 1. packages/tbd/src/web/core.ts refresh can resolve an awaited setControls call before a follow-up generation spawned from finally completes. Define and test per-request-generation promise semantics or explicitly document a different contract.

## Notes

Disposition: deferred, non-blocking. Browser callers do not rely on overlapping setControls await completion. Define request-generation promise semantics and add a deterministic overlap test in a focused follow-up.
