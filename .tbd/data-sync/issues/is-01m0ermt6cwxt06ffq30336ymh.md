---
type: is
id: is-01m0ermt6cwxt06ffq30336ymh
title: Provision and walk the Draft and Blocked columns
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
created_at: 2026-08-20T05:00:05.195Z
updated_at: 2026-08-20T05:22:11.606Z
started_at: 2026-08-20T05:19:07.537Z
closed_at: 2026-08-20T05:22:11.604Z
close_reason: |-
  VERIFIED LIVE on team OS. Draft created at position 1000 (after Backlog) and Blocked at 1004 (after Paused) — both placed by band, both bound on a re-run. Walked a real bead through Blocked: open+hold:blocked correctly lands in Backlog per the ladder (un-started held work has no started-type column), and in_progress+hold:blocked lands in Blocked/started with startedAt set. The board now carries all five columns the projection describes: Backlog, Draft, Todo, In Progress, In Review, Paused, Blocked, Done, Canceled, Duplicate.
  Also observed: setting a hold on closed work is correctly refused by the write boundary ('hold is only valid on work that is not closed'), though the CLI surfaces it as a raw Zod dump rather than a clean message — filed separately.
resolution: null
duplicate_of: null
---
Dogfooding created only Paused, to keep the team-wide footprint to one column. Draft and Blocked remain unexercised on a real board.
