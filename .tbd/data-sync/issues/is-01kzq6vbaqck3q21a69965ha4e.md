---
type: is
id: is-01kzq6vbaqck3q21a69965ha4e
title: "Phase 2: core foundations for tbd web (issue-query, AbortSignal, sync-run)"
kind: task
status: in_progress
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels: []
dependencies: []
created_at: 2026-08-11T01:26:33.046Z
updated_at: 2026-08-11T01:34:43.991Z
---
Phase 2 of PR 207 per the plan's module map: extract src/lib/issue-query.ts with parity oracle and refactor list/ready onto it; AbortSignal through bead-watch.ts with a git.ts options overload; src/file/sync-run.ts extraction of the pull path; plus tbd-5hh1 and tbd-q5c7 fixes.

## Notes

Tranche 1 committed locally: issue-query extraction + list/ready refactor + parity oracle (3 tests, id-sequence-exact across query space); tbd-5hh1 and tbd-q5c7 fixed with tests. Remaining: AbortSignal through bead-watch + git.ts overload; sync-run extraction. Full suite + gated push BLOCKED on disk space (3.3GB free, guardrail).
