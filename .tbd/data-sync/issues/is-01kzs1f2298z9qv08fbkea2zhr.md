---
type: is
id: is-01kzs1f2298z9qv08fbkea2zhr
title: "R12: Preserve the remote wake cursor when pull cannot apply"
kind: bug
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - final-review
  - correctness
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T18:30:56.328Z
updated_at: 2026-08-11T19:29:55.247Z
closed_at: 2026-08-11T19:29:55.243Z
close_reason: Fixed by treating remote-missing as retryable without publishing or advancing cursor state. Regression coverage passed in the final 1,498-test matrix, the PR thread is resolved, and Cursor Bugbot passed on head 66a63cca.
---
Bugbot thread PRRT_kwDOQ109P86YVKe4 identifies a real state-machine gap. In packages/tbd/src/cli/web/wake.ts, WakeCoordinator.applyReport() ignores IssueSyncResult and advances watchSince/report state after runIssueSync() returns remote-missing, even though the hidden worktree was not updated. Handle the result exhaustively: accept pulled/up-to-date, but convert remote-missing into a retryable report-handling failure before BoardState.reload() and before watchSince, lastReport, changedIds, or wakeCount advance. In packages/tbd/tests/web-wake.test.ts, add a regression proving remote-missing preserves the prior cursor, records an error, does not publish a wake, and retries from the same baseline.

## Notes

Fixed by treating remote-missing as retryable without publishing or advancing cursor state. Regression coverage passed in the final 1,498-test matrix, the PR thread is resolved, and Cursor Bugbot passed on head 66a63cca.
