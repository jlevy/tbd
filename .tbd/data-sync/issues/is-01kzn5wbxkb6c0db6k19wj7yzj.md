---
type: is
id: is-01kzn5wbxkb6c0db6k19wj7yzj
title: Land tbd-web spike PR (stacked on PR 205)
kind: task
status: in_progress
priority: 2
version: 10
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - viewer
dependencies: []
child_order_hints:
  - is-01kzq6hcbgh58y4sv88g74q3n0
created_at: 2026-08-10T06:31:08.978Z
updated_at: 2026-08-11T01:21:06.415Z
extensions:
  linear:
    id: 87a13af9-a3b4-4897-873a-f8bfeb82fa65
    key: TBD-78
    url: https://linear.app/finterm-ai/issue/TBD-78/land-tbd-web-spike-pr-stacked-on-pr-205
    linked_at: 2026-08-10T19:37:39.540Z
---
Track the stacked PR for the bead-web viewer spike: branch claude/tbd-web-spike, two commits (c4439865 spike + issue-stats extraction, 6bf3f1b9 security hardening + docs) on top of PR 205 head dc0ba559. Merge is gated on PR 205 landing first; after that lands, rebase onto main and retarget the PR. Phase 1 items from the plan spec (issue-query extraction, tbd-5hh1 fix, AbortSignal, tbd-q5c7 fix) are follow-up work, not part of this PR.

## Notes

SCOPE CHANGE (owner, 2026-08-10): PR 207 is now the production-ready tbd web itself; converted to DRAFT and merges only at the plan's merge gate. Spike = Phase 1, complete. Plan refined to file/function level (module map + 6 phases + gate) in plan-2026-08-10-tbd-web-live-bead-view.md. Decisions recorded: in core, in-process watch via AbortSignal, section 1.6 amendment in this PR, v1 read-only with mutation route removed. Next: Phase 2 core foundations (issue-query extraction with parity oracle, AbortSignal, sync-run extraction, tbd-5hh1, tbd-q5c7).
