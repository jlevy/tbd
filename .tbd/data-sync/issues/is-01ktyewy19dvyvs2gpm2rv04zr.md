---
type: is
id: is-01ktyewy19dvyvs2gpm2rv04zr
title: "Spec sync: add version-skew guard row and sync drift notice to the spec"
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:25.481Z
updated_at: 2026-06-12T18:20:53.163Z
closed_at: 2026-06-12T18:20:53.163Z
close_reason: "Done in e8b5112: update decision table gains the version-skew row and design point (update + re-fork refresh), and the tbd sync drift notice is documented in the spec."
---
[Phase 0] PR #169. The implemented skip-newer-base guard (fork-update.ts, tbd-design 2.9 invariant 7) has no row in the spec update decision table, and the tbd sync one-line drift notice is absent from the spec. Bring the spec up to the implementation.
