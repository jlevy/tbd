---
type: is
id: is-01kyt5y1fvbtbjxzsrdmycnf73
title: "PR #196 review S-A: cap Myers diff edit distance with whole-field fallback"
kind: task
status: open
priority: 2
version: 2
labels:
  - pause
dependencies: []
parent_id: null
created_at: 2026-07-30T18:52:34.171Z
updated_at: 2026-08-15T05:36:52.193Z
---
diffTextLines trace is O(D^2) memory for fully rewritten large text fields (issue-changes.ts:155-179). Cap distance, fall back to whole-field replace hunk. Deferred from PR #196 round-2 review.
