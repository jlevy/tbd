---
type: is
id: is-01kzwvys9htjwc8hhnay85hmp5
title: "PR #209 review SG6: Avoid repeated facet search normalization"
kind: task
status: open
priority: 3
version: 2
labels:
  - review
  - performance
  - followup
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:37.904Z
updated_at: 2026-08-13T06:29:37.828Z
---
PR #209 senior review suggestion 6. packages/tbd/src/cli/web/board.ts buildBoardResponse reruns filterIssues across facet pools and matchesSearch repeatedly lowercases the same needle. If benchmarks justify it, normalize once and/or derive pools in one pass without duplicating filter semantics.

## Notes

Disposition: deferred, benchmark-backed. The full 10,001-row benchmark measured 17.6 ms load, 46.1 ms response build, and 32.4 ms two-key sort on this run; optimize normalization only if a future benchmark regresses.
