---
type: is
id: is-01kss6efgnqesfd3s2v29yk79m
title: "[bug] tests/lockfile.test.ts EPERM flake on Windows still hangs main CI for 20+ minutes"
kind: bug
status: open
priority: 2
version: 3
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
dependencies: []
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T06:23:49.268Z
updated_at: 2026-07-10T01:51:21.357Z
closed_at: 2026-05-29T16:22:02.977Z
close_reason: "Addressed in #140 (merged 2f5746e): withLockfile atomic stale-break + resilient release + low-staleMs/timeout test hardening; Windows CI green."
---
Same flake observed twice in the v0.2.0 push window: tests/lockfile.test.ts > withLockfile > serializes concurrent access within a single process fails with 'EPERM: operation not permitted, mkdir' on Windows. Hit on PR CI (passed on rerun) and on main CI after merge (hung 20+ min, had to be cancelled).

History: 89014f7 'fix: prevent short-ID mapping loss during concurrent issue creation', 2578056 'fix: increase lockfile test timeout for Windows CI flakiness', ac65cdf 'fix: use short staleMs in lockfile concurrency test for Windows'. At least three prior stabilization passes; still flaky.

Options to weigh:
- Mark the concurrent-access test as it.runIf(!isWindows) or describe.skip on Windows with a comment pointing to a Windows-specific issue. Cuts CI noise but loses concurrency coverage on Windows.
- Replace mkdir-based lockfile with a Windows-friendly primitive (e.g., proper-lockfile, or write-rename-then-delete).
- Investigate the underlying EPERM: rmdir cleanup race on Windows runners may need a retry/backoff.

Acceptance: main CI on a release merge commit consistently goes green within the typical 4-5 minutes, not 20+.

## Notes

Recurred 2026-07-09 after being closed as fixed by #140: Test (windows-latest) on main merge commit 0002893a (PR #184, docs-only) failed with EPERM: operation not permitted, mkdir '...\tbd-lockfile-siArjh\test.lock' at tests/lockfile.test.ts:78 (withLockfile src/utils/lockfile.ts:198). Same content passed Windows on the PR run and on the next main commit 7bafb254, so this is the same environmental flake, not caused by the docs PRs. Run: https://github.com/jlevy/tbd/actions/runs/29055804058/job/86246852126. The #140 hardening reduced but did not eliminate the race; see the options list in the description (skip-on-Windows vs proper-lockfile vs EPERM retry/backoff).
