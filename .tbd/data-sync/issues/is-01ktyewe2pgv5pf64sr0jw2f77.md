---
type: is
id: is-01ktyewe2pgv5pf64sr0jw2f77
title: Clear conflicted flag in manifest once markers are resolved
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:09.142Z
updated_at: 2026-06-12T18:20:25.829Z
closed_at: 2026-06-12T18:20:25.829Z
close_reason: "Fixed in a3a5b37: stored conflicted flag cleared on the next update once tbd-labeled markers are gone. Verified end-to-end: --merge sets flag, resolve markers, update clears it from committed forks.yml, status shows customized."
---
[Phase 3] PR #169. After resolving conflict markers, computed state is correct but committed forks.yml keeps conflicted:true until a later update writes the entry (docs-fork.ts:461-465). Spec says auto-clears. Clear it on the next status/update pass that observes markers gone.
