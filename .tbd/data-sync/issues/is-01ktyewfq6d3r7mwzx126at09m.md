---
type: is
id: is-01ktyewfq6d3r7mwzx126at09m
title: docs update with unknown names should error, not silently no-op
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:10.822Z
updated_at: 2026-06-12T18:20:23.938Z
closed_at: 2026-06-12T18:20:23.938Z
close_reason: "Fixed in a3a5b37: docs update with unknown names errors ('Not forked: ... Run tbd docs status'). Verified empirically on e8b5112."
---
[Phase 3] PR #169. docs-fork.ts:418-419 filters unknown names away; a typo yields 'All forked docs are up to date.' Error with the unmatched names and suggestions.
