---
type: is
id: is-01m044qhmd5be33jt0rj5e710g
title: Decide on customViewCreate and workspace-scoped labels for multi-repo
kind: task
status: open
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-4
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:59:38.892Z
updated_at: 2026-08-16T02:10:12.672Z
extensions:
  linear:
    id: 4b6d44e1-e8a3-4ee6-a16f-c9253b272088
    linked_at: 2026-08-16T02:10:12.672Z
---
Two things the sync deliberately does not do, both now more relevant because more repositories are planned for the opensource team:

1. customViewCreate for the 'label is not tbd:sync' filter view. API-creatable and small, but creating shared views in someone's workspace is more invasive than labels and wanted a human decision.
2. Labels are created team-scoped, matching prior behaviour. Cross-team consolidation would want workspace scope (omit teamId). A config decision, not a code gap.

Worth settling together, since both are about how a shared workspace is meant to be organised once several repos report into it.
