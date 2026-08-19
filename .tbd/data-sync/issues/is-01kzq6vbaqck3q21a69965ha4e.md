---
type: is
id: is-01kzq6vbaqck3q21a69965ha4e
title: "Phase 2: core foundations for tbd web (issue-query, AbortSignal, sync-run)"
kind: task
status: closed
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzrs66v8et3vwh2tpmk3v9d9
  - type: blocks
    target: is-01kzrs7qw8qv2ynt64n9c2w0y6
parent_id: is-01kzn5wbxkb6c0db6k19wj7yzj
child_order_hints:
  - is-01kzrs7dnqcq10ry0xeph0nsxn
created_at: 2026-08-11T01:26:33.046Z
updated_at: 2026-08-11T16:18:42.228Z
closed_at: 2026-08-11T16:18:42.227Z
close_reason: "Phase 2 complete: shared issue-query parity, hierarchy golden fix, cancellable in-process watch, JSON output guard, and reusable runIssueSync extraction are implemented and validated. The one full-suite timeout was isolated and passed; no product regression found."
extensions:
  linear:
    id: 13ad413c-ba31-4342-9daf-00c9b0887f3d
    linked_at: 2026-08-11T06:51:07.742Z
    key: TBD-131
    url: https://linear.app/finterm-ai/issue/TBD-131/phase-2-core-foundations-for-tbd-web-issue-query-abortsignal-sync-run
---
Phase 2 of PR 207 per the plan's module map: extract src/lib/issue-query.ts with parity oracle and refactor list/ready onto it; AbortSignal through bead-watch.ts with a git.ts options overload; src/file/sync-run.ts extraction of the pull path; plus tbd-5hh1 and tbd-q5c7 fixes.

## Notes

Phase 2 nearly complete on claude/tbd-web-spike: issue-query extraction + parity oracle (e5c9360d), tbd-5hh1 + tbd-q5c7 fixed and closed, AbortSignal through bead-watch/git with cancellation coverage (d984646b, 21/21 watch tests). Remaining: sync-run extraction — assessed as issue-query-sized (fullSync ~200 handler-entangled lines; go through the OperationLogger bridge with a behavior oracle), scheduled as its own next work unit. After it: Phase 3, the tbd web command itself.
