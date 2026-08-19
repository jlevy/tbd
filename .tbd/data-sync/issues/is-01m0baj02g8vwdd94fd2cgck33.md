---
type: is
id: is-01m0baj02g8vwdd94fd2cgck33
title: "Phase 2: hold, paused, and optional Paused-state provisioning"
kind: task
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies: []
parent_id: is-01m0bahns9883ea2cn8ajgnf99
created_at: 2026-08-18T20:56:09.551Z
updated_at: 2026-08-18T20:56:09.551Z
---
Add `hold`, `hold_until`, `started_at`; `tbd pause`/`resume` and bulk --hold; map open+paused to Backlog and in_progress+paused to the Paused state with carrier-label fallback; inbound from a Paused-named started state; offer Paused in `tbd integration setup` with confirmation and an explicit trailing position.

Depends on Phase 1's resolver.
