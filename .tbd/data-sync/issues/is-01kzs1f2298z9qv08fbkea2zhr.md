---
type: is
id: is-01kzs1f2298z9qv08fbkea2zhr
title: "R12: Preserve the remote wake cursor when pull cannot apply"
kind: bug
status: in_progress
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - final-review
  - correctness
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T18:30:56.328Z
updated_at: 2026-08-11T18:35:04.939Z
---
Bugbot thread PRRT_kwDOQ109P86YVKe4 identifies a real state-machine gap. In packages/tbd/src/cli/web/wake.ts, WakeCoordinator.applyReport() ignores IssueSyncResult and advances watchSince/report state after runIssueSync() returns remote-missing, even though the hidden worktree was not updated. Handle the result exhaustively: accept pulled/up-to-date, but convert remote-missing into a retryable report-handling failure before BoardState.reload() and before watchSince, lastReport, changedIds, or wakeCount advance. In packages/tbd/tests/web-wake.test.ts, add a regression proving remote-missing preserves the prior cursor, records an error, does not publish a wake, and retries from the same baseline.

## Notes

Implemented locally: applyReport now accepts only pulled/up-to-date and throws before reload/state publication on remote-missing. Added same-baseline retry regression. Validation: focused web-wake 6/6; pnpm run ci 110 files/1498 tests; web tryscript 4/4; packed web proof; 31 package pins/0 age violations. Pending final push, thread reply/resolution, and GitHub matrix.
