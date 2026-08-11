---
type: is
id: is-01kzn5wbxkb6c0db6k19wj7yzj
title: Land tbd-web spike PR (stacked on PR 205)
kind: task
status: in_progress
priority: 2
version: 13
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - viewer
dependencies: []
child_order_hints:
  - is-01kzq6hcbgh58y4sv88g74q3n0
  - is-01kzq7dpztf9sy32xaxf63apwg
  - is-01kzq7dqe458wkrabss0a0qewp
created_at: 2026-08-10T06:31:08.978Z
updated_at: 2026-08-11T04:42:46.395Z
extensions:
  linear:
    id: 87a13af9-a3b4-4897-873a-f8bfeb82fa65
    key: TBD-78
    url: https://linear.app/finterm-ai/issue/TBD-78/land-tbd-web-spike-pr-stacked-on-pr-205
    linked_at: 2026-08-10T19:37:39.540Z
---
Track the stacked PR for the bead-web viewer spike: branch claude/tbd-web-spike, two commits (c4439865 spike + issue-stats extraction, 6bf3f1b9 security hardening + docs) on top of PR 205 head dc0ba559. Merge is gated on PR 205 landing first; after that lands, rebase onto main and retarget the PR. Phase 1 items from the plan spec (issue-query extraction, tbd-5hh1 fix, AbortSignal, tbd-q5c7 fix) are follow-up work, not part of this PR.

## Notes

Senior review + 3 Bugbot threads addressed in 6edccb89; disposition map posted; all threads resolved; R1/R2 resolved by the draft merge-gate contract, alpha-slice declined per owner directive. Phase 2 tranche 1 (e5c9360d) pushed through full gate. CI pending on new head.
