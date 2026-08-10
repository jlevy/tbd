---
type: is
id: is-01kzn5wbxkb6c0db6k19wj7yzj
title: Land tbd-web spike PR (stacked on PR 205)
kind: task
status: in_progress
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - viewer
dependencies: []
created_at: 2026-08-10T06:31:08.978Z
updated_at: 2026-08-10T21:35:28.515Z
extensions:
  linear:
    id: 87a13af9-a3b4-4897-873a-f8bfeb82fa65
    key: FIN-92
    url: https://linear.app/finterm-ai/issue/FIN-92/land-tbd-web-spike-pr-stacked-on-pr-205
    linked_at: 2026-08-10T19:37:39.540Z
---
Track the stacked PR for the bead-web viewer spike: branch claude/tbd-web-spike, two commits (c4439865 spike + issue-stats extraction, 6bf3f1b9 security hardening + docs) on top of PR 205 head dc0ba559. Merge is gated on PR 205 landing first; after that lands, rebase onto main and retarget the PR. Phase 1 items from the plan spec (issue-query extraction, tbd-5hh1 fix, AbortSignal, tbd-q5c7 fix) are follow-up work, not part of this PR.

## Notes

PR 205 merged (2734a61c); origin/main merged into claude/tbd-web-spike (cb3675e3, clean), base auto-retargeted to main. Semantic reconciliation 958744f9: adopted upstream 227c7ff0 dropping the report format_version marker; viewer report mirror and plan spec now state the additive-only --json contract and reference tbd-design.md 4.14. Upstream docs pass (f8e52a16) merged cleanly beside the viewer docs. Gated push green; awaiting CI on 958744f9. Remaining: merge PR 207 when ready.
