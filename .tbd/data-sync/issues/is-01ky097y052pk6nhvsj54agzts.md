---
type: is
id: is-01ky097y052pk6nhvsj54agzts
title: "S1: Reconcile Phase 2 external-sync designs"
kind: task
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - pr-review
  - github-196
  - phase-2
dependencies: []
parent_id: is-01ky0976vg9em86ra5ad9myh4c
created_at: 2026-07-20T17:30:08.772Z
updated_at: 2026-08-04T23:46:45.305Z
closed_at: 2026-08-04T23:46:45.305Z
close_reason: "Delivered as §6a of plan-2026-07-20-linear-bead-sync-pilot.md (commit d21a701): command naming unified on tbd bridge, linked field replaces interim label bindings, base snapshots + content hashes as complementary echo suppression, comments model as the inbound landing spot, single-writer CI as steady state."
---
Before Phase 2 implementation, reconcile this spec with sibling external-sync design decisions: bridge versus mirror, linked field versus label/marker, and base snapshots versus hashes. Explicitly deferred until Phase 1 is validated.

## Notes

Deferred by the PR #196 senior review. Reconcile the sibling claude/linear-bead-sync-plan-tct4hn plan before Phase 2: bridge versus mirror, linked field versus label/marker, and base snapshots versus hashes. Phase 1 does not implement external sync.
