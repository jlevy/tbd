---
type: is
id: is-01kzn5wbxkb6c0db6k19wj7yzj
title: Land tbd-web spike PR (stacked on PR 205)
kind: task
status: in_progress
priority: 2
version: 14
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - viewer
dependencies: []
child_order_hints:
  - is-01kzq6hcbgh58y4sv88g74q3n0
  - is-01kzq7dpztf9sy32xaxf63apwg
  - is-01kzq7dqe458wkrabss0a0qewp
created_at: 2026-08-10T06:31:08.978Z
updated_at: 2026-08-11T05:20:45.884Z
extensions:
  linear:
    id: 87a13af9-a3b4-4897-873a-f8bfeb82fa65
    key: TBD-78
    url: https://linear.app/finterm-ai/issue/TBD-78/land-tbd-web-spike-pr-stacked-on-pr-205
    linked_at: 2026-08-10T19:37:39.540Z
---
Track the stacked PR for the bead-web viewer spike: branch claude/tbd-web-spike, two commits (c4439865 spike + issue-stats extraction, 6bf3f1b9 security hardening + docs) on top of PR 205 head dc0ba559. Merge is gated on PR 205 landing first; after that lands, rebase onto main and retarget the PR. Phase 1 items from the plan spec (issue-query extraction, tbd-5hh1 fix, AbortSignal, tbd-q5c7 fix) are follow-up work, not part of this PR.

## Notes

PR 207 head d984646b: Phase 2 at 4/5 (issue-query + parity oracle, tbd-5hh1, tbd-q5c7, AbortSignal), all gated, CI green. Remaining: sync-run extraction via OperationLogger, then Phase 3 (the tbd web command). This update doubles as a live remote-wake demo for the viewer.
