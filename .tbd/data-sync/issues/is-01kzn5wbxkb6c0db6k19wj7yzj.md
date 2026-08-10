---
type: is
id: is-01kzn5wbxkb6c0db6k19wj7yzj
title: Land tbd-web spike PR (stacked on PR 205)
kind: task
status: in_progress
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - viewer
dependencies: []
created_at: 2026-08-10T06:31:08.978Z
updated_at: 2026-08-10T21:26:58.760Z
extensions:
  linear:
    id: 87a13af9-a3b4-4897-873a-f8bfeb82fa65
    key: FIN-92
    url: https://linear.app/finterm-ai/issue/FIN-92/land-tbd-web-spike-pr-stacked-on-pr-205
    linked_at: 2026-08-10T19:37:39.540Z
---
Track the stacked PR for the bead-web viewer spike: branch claude/tbd-web-spike, two commits (c4439865 spike + issue-stats extraction, 6bf3f1b9 security hardening + docs) on top of PR 205 head dc0ba559. Merge is gated on PR 205 landing first; after that lands, rebase onto main and retarget the PR. Phase 1 items from the plan spec (issue-query extraction, tbd-5hh1 fix, AbortSignal, tbd-q5c7 fix) are follow-up work, not part of this PR.

## Notes

PR https://github.com/jlevy/tbd/pull/207 green on ac3b0776 (all 7 checks incl. Bugbot re-review). Review addressed: R1 ULID tiebreak, R2 ready-sort exactness, R3 context-row disclosure, R4 wake-marker coherence via reportDataVersion stamp. Threads resolved, disposition map posted. Remaining: PR 205 merges, then rebase this branch onto main and retarget.
