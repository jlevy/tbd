---
type: is
id: is-01m2egx4gsnz7t61bpdvpcpqhw
title: "Port mirror-only behavior into the engine: create labels, delegate, actor priming, attachments, parent"
kind: task
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies:
  - type: blocks
    target: is-01m2egx888wh2r62pt8ce4d3wz
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-13T23:16:12.951Z
updated_at: 2026-09-14T02:58:50.308Z
---
Behavior only the mirror has today, to move into the engine before the mirror is deleted: mirrored labels and delegate on create (delegate is pushed only by the mirror, so the agent_map fix in PR #283 depends on this to stay reachable; note that delegateId starts a Linear Agent Session); actor priming (integration-runner.ts:385); attachment refresh, with change detection so settled pairs stay quiet (mirror.ts attachmentsFor). Parent: the linked parent is authoritative and a parent outside the selection is left unchanged, never written as null (mirror.ts:250-274 nulls it today, so `--push --bead <child>` detaches a sub-issue). Keep attachmentsFor, depthWithinSelection, prefixLabels.

Tests: `--push --bead <child>` leaves the provider parent unchanged; a crash injected between create and link does not create the item twice.

2026-09-14: until this lands, the mirror sends delegateId on every --push for every selected linked bead, closed ones included, now that PR #283 honors agent_map (tbd-80vz). Port delegate with change detection and skip closed beads.

f08 compatibility review 2026-09-14 (see 'f08 Compatibility Contract for Sprint Fixes' in the stability sprint plan): detect attachment changes against the remote item, not a new stored field (old clients drop undeclared bridge fields).
