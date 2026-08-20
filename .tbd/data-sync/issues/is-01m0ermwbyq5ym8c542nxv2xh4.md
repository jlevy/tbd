---
type: is
id: is-01m0ermwbyq5ym8c542nxv2xh4
title: Offer to reposition states whose order contradicts the slot order
kind: task
status: closed
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
delegate: claude-code@spud10
labels: []
dependencies: []
parent_id: is-01m0ermjzgy620e6gx9mtp7z9d
hold: null
hold_until: null
created_at: 2026-08-20T05:00:07.415Z
updated_at: 2026-08-20T05:45:48.731Z
started_at: 2026-08-20T05:39:39.307Z
closed_at: 2026-08-20T05:45:48.730Z
close_reason: "Implemented. Provisioning detects a state whose position puts it before a state belonging earlier in the lifecycle, reports it on a dry run, and repositions it under --apply. Constrained to states named in state_map: an existing test caught the first version moving Done, which no map mentioned, and 'never touch a state outside the map' outranks a tidier board."
resolution: null
duplicate_of: null
---
State Phase 4 residual. tbd places states it creates correctly but will not rearrange a board a human already arranged. Also: two-slots-one-state disambiguation by carrier label.
