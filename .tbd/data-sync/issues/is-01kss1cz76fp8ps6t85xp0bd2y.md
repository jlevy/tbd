---
type: is
id: is-01kss1cz76fp8ps6t85xp0bd2y
title: doctor --fix missing-worktree init bypasses shared lock
kind: bug
status: closed
priority: 1
version: 3
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
  - release-blocker
dependencies: []
parent_id: is-01ksrpdkemmkkhh4j6egqyrvsq
created_at: 2026-05-29T04:55:36.933Z
updated_at: 2026-05-29T05:09:01.188Z
closed_at: 2026-05-29T05:09:01.186Z
close_reason: Wrapped the doctor.ts missing-worktree --fix path in withSharedDataSyncLock around prepareDataSyncContext, matching the existing pattern for the prunable/corrupted cases. Added a regression test (tests/common-dir-layout-doctor.test.ts) that fires two concurrent doctor --fix invocations via runTbdAsync (execFileAsync) against a missing-worktree state and asserts both exit 0 and git's worktree registry shows exactly one shared worktree. Used runTbdAsync (not runTbd/spawnSync) so the two calls actually race the event loop.
---
In PR #138, packages/tbd/src/cli/commands/doctor.ts calls prepareDataSyncContext(this.cwd) directly for the missing-worktree --fix path. prepareDataSyncContext/ensureSharedDataSyncLayout is documented as requiring withSharedDataSyncLock but does not acquire it itself. This undermines the f04 migration/repair lock contract under concurrent sibling worktrees. Wrap this path in withSharedDataSyncLock/withDataSyncContext({ lock: true }) and add a regression test or adjust the helper contract. Found during senior release review.
