---
type: is
id: is-01m05zf11zv1hbjss84p5vsg7b
title: Windows CI test timeout is the default 5s while hookTimeout is Windows-aware
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
created_at: 2026-08-16T19:06:05.745Z
updated_at: 2026-08-16T19:06:12.927Z
closed_at: 2026-08-16T19:06:12.926Z
close_reason: "testTimeout now mirrors the Windows awareness hookTimeout already had: 20s on Windows, unchanged 5s elsewhere. Confirmed the underlying failure was a marginal timeout and not a defect — a plain rerun of the same commit passed on Windows."
---
vitest.config.ts raises hookTimeout to 30s on Windows for git- and subprocess-heavy setup, but leaves testTimeout at the 5s default — so the same slowness fails in the test BODY instead.

Observed on PR 236: bridge-merge 'keeps the newest observation when both sides updated the record' failed CI at 5472ms against the 5000ms default, then passed on a plain rerun. The test drives about a dozen real git subprocesses (branch, commit, a conflicting merge, then the resolver), which is comfortable on Linux/macOS and marginal on a Windows runner under parallel load.

Fixed by giving testTimeout the same Windows awareness the hook budget already had: 20s on Windows, unchanged 5s elsewhere so the tight budget still means something where it is meaningful. A genuine hang still fails rather than running forever.

Related: tbd-7q6v, the broader load-sensitivity of the suite.
