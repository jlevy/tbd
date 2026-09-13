---
type: is
id: is-01m1yzx6mfhcc6px4p5xdnvxch
title: "Duplicate close survives the Linear round trip: applyTerminalAxis and BeadPatch.duplicate_of"
kind: bug
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:32.846Z
updated_at: 2026-09-13T23:17:23.469Z
---
GH #267. Plan 1a. Ships in the same PR as tbd-od0z, never before it.

Confirmed trace: a bead closed as duplicate has slot duplicate; the outbound decomposition turns that into resolution canceled (slots.ts:162-164), so Linear gets Canceled while the base records duplicate. Next run reads canceled, only the remote changed, so it pulls resolution canceled (sync-engine.ts:802-818) onto a bead that still carries duplicate_of; writeIssue rejects it (schemas.ts:392-397, storage.ts:74-77); the per-pair catch fires before the base advances (:1440, :1473-1480); repeats every run. Not a partial projection: the only parse sites are storage.ts:74 and parser.ts:104.

The earlier fix (clear duplicate_of whenever a patch carries another resolution) would make the sync succeed by converting the duplicate into a cancel and deleting the pointer. With tbd-od0z the phantom remote change disappears (duplicate is written to Linear's duplicate state type). Then: BeadPatch gains duplicate_of; applyTerminalAxis(stored, patch) applies status, resolution, duplicate_of together at sync-engine.ts:1383-1398; inbound duplicate on a bead with resolution duplicate and a pointer keeps both; the downgrade to canceled (:806-810) applies only to a bead with no pointer; a patch that genuinely moves the bead out of the duplicate position clears the pointer as reopen.ts:139-144 does.

e2e through the built CLI (engine unit tests' writeBead never runs IssueSchema.parse): tbd close <id> --as duplicate --duplicate-of <other>; sync three times; pointer survives and nothing fails; move the remote to Todo; sync; bead reopens with the pointer cleared. Correct state-model spec lines 511 and 513 (at PR #283's head): the duplicate relation items are checked but unimplemented (tbd-vp4p).
