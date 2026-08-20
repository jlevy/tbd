---
type: is
id: is-01m0c8v8fp3sagm3eh5bmm2n0k
title: "Phase 5: dogfood the state and actor model on this repository"
kind: task
status: open
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies: []
parent_id: is-01m0bahns9883ea2cn8ajgnf99
created_at: 2026-08-19T05:45:30.357Z
updated_at: 2026-08-20T01:34:13.404Z
extensions:
  linear:
    id: f4f25d6d-c5f6-413b-a1e6-b771e5a59253
    linked_at: 2026-08-19T16:27:26.746Z
---
Acceptance gate for all prior phases; ships nothing. Migration on ~900 real beads with zero state writes on first sync; provision the tbd Linear board and verify column order; mirror the tbd-og20 and tbd-ncux epics and assign them to the accountable human (Josh) by directory-resolved binding, not user_map; walk real beads through every column; pause genuinely stalled beads and verify Paused holds, started_at survives, tbd ready excludes them, and same-type column drags produce no patch; resume/cancel/duplicate round trips; two consecutive syncs report nothing to do; reconcile spec folders against the board. Record as a QA playbook beside valid-2026-08-16-linear-integration-live.md.

## Notes

DOGFOODED LIVE 2026-08-20 against team OS.
VERIFIED: provisioning bound all six existing columns and reported 'nothing to do' (idempotent, binds rather than duplicates); creating a Paused column placed it at position 1003, after In Review (1002) and the defaults — the explicit-position rule working on a real board; tbd pause set hold=paused with status=in_progress intact and OS-337 landed in Paused/started with Linear's startedAt preserved; tbd resume returned it to In Progress; field-level skip reporting named the OS-351 guard by reason ('field_sync.fields.assignee is "local"'); credential resolution from the main worktree (PR #249) works from a linked worktree with no copying.
BUG FOUND AND FIXED BY DOGFOODING: Linear requires color on WorkflowStateCreateInput (String!). The mock did not model it, so provisioning passed every test and failed on the first live create. Fixed by sending a per-type color, and the mock now enforces the requirement so it cannot regress. This is the third time the mock being kinder than the API produced a defect.
STILL NOT EXERCISED: Draft/Blocked columns (not provisioned here, to keep the team-wide footprint to one column); assignment by directory binding (needs field_sync.fields.assignee: merge, which the OS-351 fix deliberately requires).
