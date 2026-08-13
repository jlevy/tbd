---
type: is
id: is-01kzxxj27abvbje3nesecgsk3z
title: Dogfood Linear synchronization against the legacy tbd repository
kind: task
status: in_progress
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - dogfood
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-13T15:58:52.645Z
updated_at: 2026-08-13T16:00:52.592Z
extensions:
  linear:
    id: 583ad9a1-b8fa-4261-bfd6-a5c43fdec4a8
    linked_at: 2026-08-13T16:00:52.592Z
    key: TBD-162
    url: https://linear.app/finterm-ai/issue/TBD-162/dogfood-linear-synchronization-against-the-legacy-tbd-repository
---
Exercise the live Linear adapter against this 1,626-bead repository: verify connectivity and selection policy, inspect a dry-run disposition, perform bidirectional synchronization, prove a second run converges, persist tracker state, and expose the live read-only web view for comparison.

## Notes

Dogfood target: local 1,626-bead repository, configured Linear team TBD/project tbd. Policy selects active-spec epics plus already-linked records, max nesting 2; sync_on_tbd_sync remains intentionally disabled.
