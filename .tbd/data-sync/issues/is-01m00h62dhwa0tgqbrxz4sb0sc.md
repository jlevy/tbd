---
type: is
id: is-01m00h62dhwa0tgqbrxz4sb0sc
title: "Attention-based selection: mirror anything in_progress regardless of kind"
kind: feature
status: open
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:20:20.016Z
updated_at: 2026-08-16T00:13:41.179Z
extensions:
  linear:
    id: 60dd6442-02e4-4a6d-9667-2435051892b3
    linked_at: 2026-08-16T00:13:41.179Z
---
mirrorSet applies statuses as a global gate over both the kind rule and the spec rule, so 'epics in any active status OR anything at all that is in_progress' is inexpressible: narrowing statuses to [in_progress] would drop every open epic.

Add one clause, e.g. always_statuses: [in_progress], unioned after the existing gate:
  linked OR always_statuses.includes(status) OR (statusAllowed AND labelsAllowed AND (kindRule OR specRule))

Additive, defaults to empty, existing configs unchanged. With it, the standing set can narrow to epics (~25 here) while in-flight work (12 here) joins on claim and leaves on close — ~37 Linear issues instead of 114, showing strictly more operational detail.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §4.1, §4.2, E3
