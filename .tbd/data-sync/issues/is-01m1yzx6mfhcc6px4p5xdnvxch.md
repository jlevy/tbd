---
type: is
id: is-01m1yzx6mfhcc6px4p5xdnvxch
title: "Duplicate close survives the Linear round trip: applyTerminalAxis and BeadPatch.duplicate_of"
kind: bug
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:32.846Z
updated_at: 2026-09-07T22:31:40.836Z
---
GH #267. IssueSchema requires duplicate_of only with resolution: duplicate (schemas.ts:392-397), enforced at writeIssue (storage.ts:74). The inbound beadPatch application (sync-engine.ts:1383-1398) spreads resolution over the stored bead and never touches duplicate_of; BeadPatch has no such field (reconcile.ts:102-127). Three paths set a non-duplicate resolution on a bead carrying the pointer: decomposeSlot returns resolution null for a non-terminal slot (:747-751, slots.ts:161-177); inbound duplicate is downgraded to canceled (:806-810); any other inbound resolution is copied (:817). Fix: BeadPatch.duplicate_of; one applyTerminalAxis(stored, patch) maintaining the invariant (pattern: reopen.ts:139-144 clears both together); keep a local duplicate pair when the inbound state is duplicate; downgrade to canceled only for a bead with no pointer. e2e required: the engine unit tests' writeBead is a Map.set that never runs IssueSchema.parse. Seed with tbd close <id> --as duplicate --duplicate-of <other>, have the mock return a non-duplicate state, assert the sync succeeds and clears the pointer.
