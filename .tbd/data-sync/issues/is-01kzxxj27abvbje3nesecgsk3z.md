---
type: is
id: is-01kzxxj27abvbje3nesecgsk3z
title: Dogfood Linear synchronization against the legacy tbd repository
kind: task
status: in_progress
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - dogfood
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
child_order_hints:
  - is-01kzxy6ks7pd36nnzrppfdspq6
  - is-01kzxy6mhd66ah3xr0960n34kf
created_at: 2026-08-13T15:58:52.645Z
updated_at: 2026-08-13T16:10:06.764Z
extensions:
  linear:
    id: 583ad9a1-b8fa-4261-bfd6-a5c43fdec4a8
    linked_at: 2026-08-13T16:00:52.592Z
    key: TBD-162
    url: https://linear.app/finterm-ai/issue/TBD-162/dogfood-linear-synchronization-against-the-legacy-tbd-repository
---
Exercise the live Linear adapter against this 1,626-bead repository: verify connectivity and selection policy, inspect a dry-run disposition, perform bidirectional synchronization, prove a second run converges, persist tracker state, and expose the live read-only web view for comparison.

## Notes

Dogfood target: local 1,627-bead repository after creating this task. Configured Linear team TBD/project tbd; policy selects active-spec epics and their first two hierarchy levels plus already-linked records; sync_on_tbd_sync remains intentionally disabled. 2026-08-13 preview and live run both proposed/completed 32 linked updates plus 8 outbound creates (TBD-155..TBD-162), with zero pulls, conflicts, overwrites, orphaned links, comment mutations, or failures. Immediate second full bidirectional run converged with nothingToDo=true.
