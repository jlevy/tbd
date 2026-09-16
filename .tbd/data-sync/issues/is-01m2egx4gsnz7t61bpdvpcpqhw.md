---
type: is
id: is-01m2egx4gsnz7t61bpdvpcpqhw
title: "Port mirror-only behavior into the engine: create labels, delegate, actor priming, attachments, parent"
kind: task
status: open
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies:
  - type: blocks
    target: is-01m2egx888wh2r62pt8ce4d3wz
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-13T23:16:12.951Z
updated_at: 2026-09-16T08:28:18.630Z
extensions:
  linear:
    id: da9ae5d3-140c-4ba2-93d4-a0019c97501a
    linked_at: 2026-09-16T08:28:18.630Z
---
Behavior only the mirror has today, to move into the engine before the mirror is deleted: mirrored labels and delegate on create (delegate is pushed only by the mirror, so the agent_map fix in PR #283 depends on this to stay reachable; note that delegateId starts a Linear Agent Session); actor priming (integration-runner.ts:385); attachment refresh, with change detection so settled pairs stay quiet (mirror.ts attachmentsFor). Parent: the linked parent is authoritative and a parent outside the selection is left unchanged, never written as null (mirror.ts:250-274 nulls it today, so `--push --bead <child>` detaches a sub-issue). Keep attachmentsFor, depthWithinSelection, prefixLabels.

Tests: `--push --bead <child>` leaves the provider parent unchanged; a crash injected between create and link does not create the item twice.

2026-09-14: until this lands, the mirror sends delegateId on every --push for every selected linked bead, closed ones included, now that PR #283 honors agent_map (tbd-80vz). Port delegate with change detection and skip closed beads.

f08 compatibility review 2026-09-14 (see 'f08 Compatibility Contract for Sprint Fixes' in the stability sprint plan): detect attachment changes against the remote item, not a new stored field (old clients drop undeclared bridge fields).

## Notes

2026-09-15 (from the review of PR #294, tbd-80vz): design question for the delegate port. The interim mirror rule writes a mapped delegate when the Linear issue's current delegate differs, so a delegate that a person removed in Linear (to stop the agent), or replaced with an app user not in agent_map, is restored by the next `--push` while the bead still names the agent, and the write may start a new Agent Session. The engine port must decide how to treat a delegate removed on the remote: honor it (pull the removal to the bead, or suppress the push), or restore it. A three-way decision needs a base, but a new `base.delegate` bridge-record field conflicts with f08 rule 3 (old clients drop undeclared bridge fields), so the port needs a rule that works from the remote value alone, or it waits for a format that can carry the base.
