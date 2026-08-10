---
type: is
id: is-01kzn5wbxkb6c0db6k19wj7yzj
title: Land tbd-web spike PR (stacked on PR 205)
kind: task
status: in_progress
priority: 2
version: 8
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - viewer
dependencies: []
created_at: 2026-08-10T06:31:08.978Z
updated_at: 2026-08-10T22:10:03.790Z
extensions:
  linear:
    id: 87a13af9-a3b4-4897-873a-f8bfeb82fa65
    key: TBD-78
    url: https://linear.app/finterm-ai/issue/TBD-78/land-tbd-web-spike-pr-stacked-on-pr-205
    linked_at: 2026-08-10T19:37:39.540Z
---
Track the stacked PR for the bead-web viewer spike: branch claude/tbd-web-spike, two commits (c4439865 spike + issue-stats extraction, 6bf3f1b9 security hardening + docs) on top of PR 205 head dc0ba559. Merge is gated on PR 205 landing first; after that lands, rebase onto main and retarget the PR. Phase 1 items from the plan spec (issue-query extraction, tbd-5hh1 fix, AbortSignal, tbd-q5c7 fix) are follow-up work, not part of this PR.

## Notes

PR 207 complete and green through 0352839d: spike + review fixes + main merge + format-marker reconciliation + full productization plan (client build/packaging as strict TS via tsdown IIFE + stitched dist/web/index.html; metabrowser-derived server lifecycle: port-range search, readiness-gated --open, SSE-aware shutdown, clean signals; jsdom-free injected-transport client tests; QA floor at or above metabrowser's). Plan is implementation-ready; Phase 1 (issue-query extraction, tbd-5hh1, AbortSignal, tbd-q5c7) can start on a fresh branch off main. Phase 2 gated on the design-doc 1.6 amendment decision.
