---
type: is
id: is-01kzp7rf68f3cwjg16bh4x1y42
title: tbd sync push triggers repo pre-push code gates; bead sync takes minutes
kind: bug
status: closed
priority: 2
version: 2
labels:
  - sync
dependencies: []
created_at: 2026-08-10T16:23:12.833Z
updated_at: 2026-08-15T05:34:13.318Z
closed_at: 2026-08-15T05:34:13.318Z
close_reason: "Shipped in merged PR #227 (commit 65297780); the release workflow now handles these review findings as designed."
---
tbd sync pushes the tbd-sync data branch with a plain git push, so repo-managed hooks fire. In this repo lefthook pre-push runs ci:quality + build + the full 1,450-test suite with no branch filter, making every bead sync a ~2.5 minute full-gate run just to push YAML metadata. Code gates add no signal for a data-branch push. This compounded the 2026-08-09 machine freeze (each bead sync was a hidden full-suite run) and interacts badly with the lock bug: any impatient timeout kills sync mid-suite and orphans the lock. Fix: tbd sync should push its own branch with --no-verify (data pushes are not code pushes); optionally document a lefthook branch filter as a repo-side mitigation.
