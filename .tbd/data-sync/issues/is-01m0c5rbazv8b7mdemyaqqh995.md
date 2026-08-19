---
type: is
id: is-01m0c5rbazv8b7mdemyaqqh995
title: "Phase 1: delegate field and the claim verb"
kind: task
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0c5rk9zcamj2r525dazj73w
  - type: blocks
    target: is-01m0c5rsgkvdv8ad02eaq7109k
parent_id: is-01m0c5r461zmx3ctgsxq94s0bq
created_at: 2026-08-19T04:51:29.245Z
updated_at: 2026-08-19T05:57:21.031Z
---
Add `delegate` to the bead schema (absent reads as same as assignee); --delegate on create/update including the bulk path.

Rewire `tbd start` to set delegate instead of assignee (start.ts:142), moving the collision checks with it, so a claim stops overwriting the accountable human. Doctor reports agent-shaped assignee values left by the interim wiring and setup offers the move.

Fixes the two observability defects: field-level skip line in the sync summary, --verbose naming each excluded field with its reason, and a write-time warning for values that can never publish. Both get red-proof tests.

Depends on nothing in the sibling. Field name and format-bump approach are settled in the spec, so this is ready to start.

## Notes

PARTIAL (66fcbc58). DONE: delegate field on schema; --delegate on create/update incl. bulk and --from-file; tbd start writes delegate and leaves assignee alone, contention checks moved to delegate; 5 tests (tbd start previously had none).
NOT DONE: field-level skip reporting in the sync summary and --verbose reasons (reconcile.ts skipPush is hardcoded to assignee; sync-engine nothingToDo omits skippedPushes at :966 and :1560, so a skip-only run prints 'nothing to do'); write-time warning for unpublishable actors; doctor check for agent-shaped assignees.
