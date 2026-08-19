---
type: is
id: is-01m0baj02g8vwdd94fd2cgck33
title: "Phase 2: hold, paused, and started_at"
kind: task
status: closed
priority: 3
version: 6
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0c5qm44fxj4m6tr29k2v29f
parent_id: is-01m0bahns9883ea2cn8ajgnf99
created_at: 2026-08-18T20:56:09.551Z
updated_at: 2026-08-19T17:43:30.204Z
closed_at: 2026-08-19T17:43:30.203Z
close_reason: "State Phase 2 landed in ff182f1a: hold/hold_until/started_at with write-boundary invariants; tbd pause/resume; --hold on update incl. bulk; started_at stamped on first claim and merged earliest-wins via a new min_timestamp strategy; tbd ready excludes held work; Linear mapping prefers a named Paused state with tbd:paused carrier fallback; open+hold files to backlog; holdFromLinear inbound. 11 tests in hold-axis.test.ts plus 3 readiness tests."
resolution: null
duplicate_of: null
extensions:
  linear:
    id: 99295cf7-ed8d-4fe9-a1c1-cdfd2fb09829
    linked_at: 2026-08-19T16:27:14.355Z
---
Add `hold`, `hold_until`, `started_at`; `tbd pause`/`resume` and bulk --hold; map open+paused to Backlog and in_progress+paused to the Paused state with carrier-label fallback; inbound from a Paused-named started state.

Depends on Phase 1's resolver. Provisioning moved to Phase 4: the Paused state is created as part of the whole state_map, not on its own.
