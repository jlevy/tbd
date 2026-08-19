---
type: is
id: is-01m0c5rbazv8b7mdemyaqqh995
title: "Phase 1: delegate field and the claim verb"
kind: task
status: open
priority: 2
version: 7
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0c5rk9zcamj2r525dazj73w
  - type: blocks
    target: is-01m0c5rsgkvdv8ad02eaq7109k
parent_id: is-01m0c5r461zmx3ctgsxq94s0bq
created_at: 2026-08-19T04:51:29.245Z
updated_at: 2026-08-19T16:27:19.492Z
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

DONE (66fcbc58, 1a39d717). delegate field; --delegate on create/update incl. bulk and --from-file; tbd start writes delegate and leaves assignee alone with contention checks moved; field-level skip reporting in the push summary with causes grouped; 7 new tests (tbd start previously had none).
LIVE VERIFIED against team OS: push of beads carrying assignee=josh with empty user_map now reports 'fields not pushed 2' and '- assignee: no user_map entry for josh (2 beads)'; previously printed 'skipped 0' and nothing else.
NOT DONE: write-time warning when setting an actor that can never publish; doctor check for agent-shaped assignees; the reconcile-path skipPush generalization (still assignee-hardcoded at reconcile.ts:303, and sync-engine nothingToDo still omits skippedPushes at :966/:1560, so a skip-only full sync can still read as 'nothing to do').
