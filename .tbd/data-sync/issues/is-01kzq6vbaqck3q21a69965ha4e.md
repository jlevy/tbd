---
type: is
id: is-01kzq6vbaqck3q21a69965ha4e
title: "Phase 2: core foundations for tbd web (issue-query, AbortSignal, sync-run)"
kind: task
status: in_progress
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels: []
dependencies: []
created_at: 2026-08-11T01:26:33.046Z
updated_at: 2026-08-11T04:42:45.422Z
---
Phase 2 of PR 207 per the plan's module map: extract src/lib/issue-query.ts with parity oracle and refactor list/ready onto it; AbortSignal through bead-watch.ts with a git.ts options overload; src/file/sync-run.ts extraction of the pull path; plus tbd-5hh1 and tbd-q5c7 fixes.

## Notes

Tranche 1 pushed and gated (e5c9360d): issue-query extraction + parity oracle, tbd-5hh1, tbd-q5c7. Senior review R3-R6 fixed and pushed (6edccb89): write surface deleted, board race fixes. Remaining: AbortSignal through bead-watch + git.ts overload; sync-run extraction assessment.
