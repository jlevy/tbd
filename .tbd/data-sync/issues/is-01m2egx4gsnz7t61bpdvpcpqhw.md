---
type: is
id: is-01m2egx4gsnz7t61bpdvpcpqhw
title: "Port mirror-only behavior into the engine: create labels, delegate, actor priming, attachments, parent"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies:
  - type: blocks
    target: is-01m2egx888wh2r62pt8ce4d3wz
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-13T23:16:12.951Z
updated_at: 2026-09-13T23:18:42.405Z
---
Behavior only the mirror has today, to move into the engine before the mirror is deleted: mirrored labels and delegate on create (delegate is pushed only by the mirror, so the agent_map fix in PR #283 depends on this to stay reachable; note that delegateId starts a Linear Agent Session); actor priming (integration-runner.ts:385); attachment refresh, with change detection so settled pairs stay quiet (mirror.ts attachmentsFor). Parent: the linked parent is authoritative and a parent outside the selection is left unchanged, never written as null (mirror.ts:250-274 nulls it today, so `--push --bead <child>` detaches a sub-issue). Keep attachmentsFor, depthWithinSelection, prefixLabels.

Tests: `--push --bead <child>` leaves the provider parent unchanged; a crash injected between create and link does not create the item twice.
