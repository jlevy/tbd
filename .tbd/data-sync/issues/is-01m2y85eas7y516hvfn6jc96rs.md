---
type: is
id: is-01m2y85eas7y516hvfn6jc96rs
title: Bound corrupted-data test subprocesses and assert fixture initialization
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-20T01:51:18.871Z
updated_at: 2026-09-20T01:51:18.871Z
---
During PR #309/#310 final validation, the local filesystem hit ENOSPC (about 116 MiB free). The full pre-push suite later stopped advancing in corrupted-data.test.ts: runTbd(['create', 'Test issue', '--type=task']) waited on the fixture's data-sync lock. The recorded lock owner was the exited initialization process; the fixture had no completed shared layout. DATA_SYNC_LOCK_OPTIONS uses a 30-minute stale window and 35-minute timeout.

The test's initGitAndTbd() ignores the result of tbd init, and runTbd() uses spawnSync without a timeout. Vitest's test timeout cannot interrupt that blocked worker. The isolated child was terminated so the gate could fail instead of waiting 30 minutes. No production lock setting was changed. Environment failure is the likely trigger; the missing fixture assertion and subprocess bound are directly verified in the source.

Follow-up: assert initialization succeeds before continuing; bound synchronous CLI subprocesses and include their status/stdout/stderr in the failure. Cover an injected initialization failure and verify prompt failure without changing the production lock-recovery safety contract. This pre-existing harness issue is outside the policy/setup review fixes. Related review task: tbd-icyj.
