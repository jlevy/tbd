---
type: is
id: is-01kxz3mfsysxwdhm0yfwg1sfa6
title: "Phase 2: subset sync, conflict resolution, tbd sync integration, mock-server golden tests"
kind: feature
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-07-20-linear-bead-sync-pilot.md
labels:
  - linear-sync
dependencies:
  - type: blocks
    target: is-01kxz3mgdhc9j6ys7brk59z96e
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:54.334Z
updated_at: 2026-07-20T06:46:22.014Z
---
Batched pull for all links per provider (single filtered query) + full push scan; per-field conflicts → LWW with attic entries; orphan detection for archived/deleted Linear issues; tbd bridge status; fold into tbd sync 5-step ordering behind bridges.sync_on_tbd_sync; mock Linear GraphQL fixture server (LINEAR_API_URL override) + golden tryscript covering link/sync/pull/push/conflict/idempotent-double-run/link-guard; bulk tbd bridge import --provider linear --team --state --limit. Spec Phase 2.
