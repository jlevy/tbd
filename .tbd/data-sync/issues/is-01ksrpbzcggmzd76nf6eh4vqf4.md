---
type: is
id: is-01ksrpbzcggmzd76nf6eh4vqf4
title: "[bug] Migration affordance mismatch: tbd status/doctor direct users to 'doctor --fix' but f03→f04 migration only runs via 'tbd sync'"
kind: bug
status: closed
priority: 1
version: 4
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
dependencies:
  - type: blocks
    target: is-01ksrpdkemmkkhh4j6egqyrvsq
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T01:42:49.999Z
updated_at: 2026-05-29T01:55:54.371Z
closed_at: 2026-05-29T01:55:54.370Z
close_reason: Fixed via doctor --fix migrating missing shared worktree to f04 (calls prepareDataSyncContext); status renders 'not initialized' instead of 'unhealthy' for the missing case. Verified on ATA-style scratch repo + new e2e test.
---
Observed on ai-trade-arena (3548 issues): 'tbd status' shows 'Worktree (unhealthy) — Run: tbd doctor --fix'. Running 'doctor --fix' reports the worktree is fine and says 'Common-dir layout - not initialized yet (created on first sync)'. Migration actually runs on 'tbd sync'. The user has to discover this.

Pick one of:
- A. Make 'tbd doctor --fix' perform the f03→f04 migration (acquire shared lock, write layout, bump config — same code path the sync triggers).
- B. Change the hint in 'tbd status' (and 'doctor') to say 'Run: tbd sync' when this specific transition is detected.

Recommend A (doctor --fix actually fixes), with B as a fallback if A's blast radius is too big for v0.2.0.

Key files:
- packages/tbd/src/cli/commands/status.ts (the 'Worktree ... (unhealthy)' line + hint)
- packages/tbd/src/cli/commands/doctor.ts (checkCommonDirLayout + doctor --fix dispatch)
- packages/tbd/src/file/common-dir-layout.ts
- packages/tbd/src/cli/commands/sync.ts (current migration entry point)

Tests:
- packages/tbd/tests/common-dir-layout-doctor.test.ts
- packages/tbd/tests/cli-shared-common-dir-worktree.tryscript.md

QA reference: tests/qa/release-v0.2.0-upgrade.qa.md §2.B finding.
