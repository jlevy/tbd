---
type: is
id: is-01m044ppfx0jkk2ddfe2faf5pn
title: Populate identity.user_map so assignee sync stops being skipped
kind: task
status: closed
priority: 3
version: 4
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:59:11.100Z
updated_at: 2026-08-20T06:01:20.001Z
closed_at: 2026-08-20T06:01:20.000Z
close_reason: "Superseded by the actor axis. user_map no longer needs populating: humans resolve against the workspace directory and bind by provider user id under bridge/linear/users/, verified live this session with user_map:{}. The map survives as an override for cases the directory cannot answer, but filling it in is no longer the prerequisite this bead describes."
resolution: canceled
duplicate_of: null
extensions:
  linear:
    id: 8884680f-5cbe-418b-bfed-9262f24db5da
    linked_at: 2026-08-16T02:11:55.617Z
---
Every live sync of this repository ends with two warnings:

  ! OS-166: Linear assignee is not present in user_map; assignee synchronization skipped.
  ! OS-162: Linear assignee is not present in user_map; assignee synchronization skipped.

integrations.linear.identity.user_map is {} in .tbd/config.yml, so any Linear-side assignee has no canonical alias to map to and assignee sync is skipped for that pair. Not a code defect — the guard is working — but it means the assignee field is inert for those issues, and the warnings are permanent noise on an otherwise clean sync.

Map the Linear users to their tbd aliases, or decide assignee stays local-only and downgrade the message.
