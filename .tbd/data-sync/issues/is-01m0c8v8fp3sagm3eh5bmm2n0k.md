---
type: is
id: is-01m0c8v8fp3sagm3eh5bmm2n0k
title: "Phase 5: dogfood the state and actor model on this repository"
kind: task
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies: []
parent_id: is-01m0bahns9883ea2cn8ajgnf99
created_at: 2026-08-19T05:45:30.357Z
updated_at: 2026-08-19T16:25:59.292Z
extensions:
  linear:
    id: f4f25d6d-c5f6-413b-a1e6-b771e5a59253
    linked_at: 2026-08-19T16:25:59.292Z
---
Acceptance gate for all prior phases; ships nothing. Migration on ~900 real beads with zero state writes on first sync; provision the tbd Linear board and verify column order; mirror the tbd-og20 and tbd-ncux epics and assign them to the accountable human (Josh) by directory-resolved binding, not user_map; walk real beads through every column; pause genuinely stalled beads and verify Paused holds, started_at survives, tbd ready excludes them, and same-type column drags produce no patch; resume/cancel/duplicate round trips; two consecutive syncs report nothing to do; reconcile spec folders against the board. Record as a QA playbook beside valid-2026-08-16-linear-integration-live.md.

## Notes

PARTIALLY EXERCISED 2026-08-19 against the real Linear workspace (team OS, project tbd).
VERIFIED LIVE: terminal resolution round-trip (OS-242 Canceled/canceled, completedAt=null, canceledAt set); epics mirrored (OS-337 state model, OS-339 actor axis) and assigned to josh locally; name-based state resolution against a real board with two started states (In Progress at position 2, In Review at 1002); field-level skip reporting; new fields round-trip ~900 real beads with doctor 'Issue validity' clean.
NOT VERIFIED: board provisioning and the Draft/Paused/Blocked columns (Phases 2-4 not implemented, so there is nothing to provision yet); the no-fight property; assignment by directory binding (needs actor Phase 2 — user_map is empty and assignee cannot publish today, which is exactly what the new reporting now says out loud).
NOTE: 'tbd integration sync --push' reports 'updated N' on every run because the mirror path is a projection that never diffs the remote. Pre-existing, not introduced here; the settle property belongs to the full bidirectional sync.
