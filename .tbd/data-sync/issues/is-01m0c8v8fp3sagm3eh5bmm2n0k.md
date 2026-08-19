---
type: is
id: is-01m0c8v8fp3sagm3eh5bmm2n0k
title: "Phase 5: dogfood the state and actor model on this repository"
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies: []
parent_id: is-01m0bahns9883ea2cn8ajgnf99
created_at: 2026-08-19T05:45:30.357Z
updated_at: 2026-08-19T05:57:21.369Z
---
Acceptance gate for all prior phases; ships nothing. Migration on ~900 real beads with zero state writes on first sync; provision the tbd Linear board and verify column order; mirror the tbd-og20 and tbd-ncux epics and assign them to the accountable human (Josh) by directory-resolved binding, not user_map; walk real beads through every column; pause genuinely stalled beads and verify Paused holds, started_at survives, tbd ready excludes them, and same-type column drags produce no patch; resume/cancel/duplicate round trips; two consecutive syncs report nothing to do; reconcile spec folders against the board. Record as a QA playbook beside valid-2026-08-16-linear-integration-live.md.

## Notes

PARTIALLY EXERCISED 2026-08-18 on this repo, local half only.
VERIFIED: new fields round-trip through ~900 real beads (doctor 'Issue validity' clean); tbd close --as canceled applied to the genuinely superseded tbd-f8y4 — the exact case that motivated #244; epics tbd-og20/tbd-ncux assigned to josh; tbd start on tbd-pha0 wrote delegate with assignee untouched; migration of agent-shaped assignees ran 1 -> 0; tbd sync succeeded.
BLOCKED: everything needing the Linear API — LINEAR_API_KEY is not in the agent environment, so board provisioning, column round-trips, assignment-by-binding, and the no-fight property are unverified. The 2 doctor integration problems are pre-existing (identical on stock tbd 0.7.1).
