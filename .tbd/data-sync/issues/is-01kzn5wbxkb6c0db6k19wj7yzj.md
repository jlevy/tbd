---
type: is
id: is-01kzn5wbxkb6c0db6k19wj7yzj
title: Land tbd-web spike PR (stacked on PR 205)
kind: task
status: in_progress
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - viewer
dependencies: []
created_at: 2026-08-10T06:31:08.978Z
updated_at: 2026-08-10T06:37:50.626Z
---
Track the stacked PR for the bead-web viewer spike: branch claude/tbd-web-spike, two commits (c4439865 spike + issue-stats extraction, 6bf3f1b9 security hardening + docs) on top of PR 205 head dc0ba559. Merge is gated on PR 205 landing first; after that lands, rebase onto main and retarget the PR. Phase 1 items from the plan spec (issue-query extraction, tbd-5hh1 fix, AbortSignal, tbd-q5c7 fix) are follow-up work, not part of this PR.

## Notes

PR opened: https://github.com/jlevy/tbd/pull/207, stacked on PR 205 (base claude/watch-infrastructure). Branch pushed with pre-push gates green from a clean worktree (build + 101 files / 1,458 tests). Waiting on CI. After PR 205 merges: rebase onto main, retarget base, re-run CI, then land.
