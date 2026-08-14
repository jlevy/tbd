---
type: is
id: is-01kzwvynhtm54mj9qc2ekjh7p3
title: "PR #209 review S10: Make missing tree-map nodes deterministic"
kind: bug
status: open
priority: 2
version: 2
labels:
  - review
  - robustness
  - followup
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:34.073Z
updated_at: 2026-08-13T06:29:36.633Z
---
PR #209 senior review S10. packages/tbd/src/cli/web/board.ts orderAsTree asserts issueByDisplayId membership while walk skips missing nodes and mis-indents descendants. Use a tree structure/map invariant that cannot desynchronize or handle missing nodes consistently in root sorting and traversal.

## Notes

Disposition: deferred, non-blocking. The issue map and tree are built from the same validated snapshot, so the inconsistent defensive branch is unreachable under current invariants. Consolidate the structures in a dedicated robustness refactor.
