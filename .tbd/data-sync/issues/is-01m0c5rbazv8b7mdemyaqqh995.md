---
type: is
id: is-01m0c5rbazv8b7mdemyaqqh995
title: "Phase 1: delegate field and the claim verb"
kind: task
status: open
priority: 2
version: 8
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0c5rk9zcamj2r525dazj73w
  - type: blocks
    target: is-01m0c5rsgkvdv8ad02eaq7109k
parent_id: is-01m0c5r461zmx3ctgsxq94s0bq
created_at: 2026-08-19T04:51:29.245Z
updated_at: 2026-08-19T17:43:30.870Z
extensions:
  linear:
    id: 273e109a-3300-454d-8444-d1fe166ae62a
    linked_at: 2026-08-19T16:27:19.492Z
---
Add `delegate` to the bead schema (absent reads as same as assignee); --delegate on create/update including the bulk path.

Rewire `tbd start` to set delegate instead of assignee (start.ts:142), moving the collision checks with it, so a claim stops overwriting the accountable human. Doctor reports agent-shaped assignee values left by the interim wiring and setup offers the move.

Fixes the two observability defects: field-level skip line in the sync summary, --verbose naming each excluded field with its reason, and a write-time warning for values that can never publish. Both get red-proof tests.

Depends on nothing in the sibling. Field name and format-bump approach are settled in the spec, so this is ready to start.

## Notes

DONE (66fcbc58, 1a39d717, f8719390). delegate field; --delegate on create/update incl bulk and --from-file; tbd start writes delegate and stamps started_at; field-level skip reporting with provider-supplied reasons; tbd doctor 'Actor axis' check reports agent-shaped assignees.
NOT DONE: write-time warning when setting an actor that can never publish; reconcile-path skipPush is still assignee-hardcoded and sync-engine nothingToDo still omits skippedPushes (:966/:1560), so a skip-only FULL sync can still read as 'nothing to do' — the mirror/--push path is fixed, the reconcile path is not.
