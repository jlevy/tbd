---
type: is
id: is-01m044ppfx0jkk2ddfe2faf5pn
title: Populate identity.user_map so assignee sync stops being skipped
kind: task
status: open
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:59:11.100Z
updated_at: 2026-08-16T02:10:12.647Z
extensions:
  linear:
    id: 8884680f-5cbe-418b-bfed-9262f24db5da
    linked_at: 2026-08-16T02:10:12.647Z
---
Every live sync of this repository ends with two warnings:

  ! OS-166: Linear assignee is not present in user_map; assignee synchronization skipped.
  ! OS-162: Linear assignee is not present in user_map; assignee synchronization skipped.

integrations.linear.identity.user_map is {} in .tbd/config.yml, so any Linear-side assignee has no canonical alias to map to and assignee sync is skipped for that pair. Not a code defect — the guard is working — but it means the assignee field is inert for those issues, and the warnings are permanent noise on an otherwise clean sync.

Map the Linear users to their tbd aliases, or decide assignee stays local-only and downgrade the message.
