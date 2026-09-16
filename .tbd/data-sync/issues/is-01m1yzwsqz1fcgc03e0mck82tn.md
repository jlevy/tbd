---
type: is
id: is-01m1yzwsqz1fcgc03e0mck82tn
title: "Land the 2026-08-28 stability branch: rebase claude/tbd-sync-bugs-review-f1qb1f onto main and merge"
kind: task
status: in_progress
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
delegate: claude-code@spud10.local
labels:
  - phase-0
dependencies:
  - type: blocks
    target: is-01m1yzwv5hxya72fgnk91pb3gv
  - type: blocks
    target: is-01m1yzx83jc1eyn522mxfg5cc1
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
hold: null
hold_until: null
created_at: 2026-09-07T22:30:19.640Z
updated_at: 2026-09-16T08:27:05.223Z
started_at: 2026-09-16T07:18:41.316Z
extensions:
  linear:
    id: f25c4987-f9fd-46d3-8542-d147e908eae9
    linked_at: 2026-09-16T08:27:05.223Z
---
Three commits (4d23edcf, ed45804a, 936909fe), seven files, +785/-9: the spec plan-2026-08-28-sync-convergence-and-stability.md plus tbd-10zb, tbd-p40p, tbd-8gcz, tbd-r1a3, tbd-aypl (--explain) and the mock stateId fix. git merge-tree against origin/main reports no conflicts; main is 7 commits ahead. Rebase, run tests/integrations-sync-engine.test.ts, tests/integration-cli-e2e.test.ts and the cli-sync* tryscripts, open the PR, merge. Landing the spec file also stops its 31 beads reading as dangling.

Revision 2026-09-13 (plan review against main and PRs #278-#283): Merge PR #280 first (CI audit fails without it). Before opening the PR, close four gaps found reviewing the branch: (1) count orphaned in the dry-run nothingToDo (red: archived reopened pair); (2) a skipped push caused by policy or capability (assignee: local, no user_map entry) does not hold nothingToDo false, since 8gcz makes dry runs report it on every run; (3) --explain shows local, remote, and base values, a line for a managed-block-only push, and refuses with --push instead of ignoring it; (4) note the merge commit on the five closed beads (10zb, p40p, r1a3, 8gcz, aypl).
