---
type: is
id: is-01m14z1bp3gncnvfv7vyxm9c5w
title: Dry-run reports omit skippedPushes entirely, so a dry run cannot name a stuck field
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T19:55:05.283Z
updated_at: 2026-08-28T19:55:05.283Z
---
GH #265 diagnosis gap, confirmed. report.skippedPushes is populated at sync-engine.ts:1376-1377, in the execute path only. The dry-run branch returns at sync-engine.ts:1083 before reaching it.

Consequences:
1. A dry run never prints the 'push unsupported; left divergent' detail lines (cli/commands/integration.ts:571-573).
2. The skippedPushes.length === 0 term in the dry-run nothingToDo (sync-engine.ts:1081) is inert: the value it tests can never be non-zero on that path. Its own comment says the detail lines 'are behind this early return'. They are; the fix was never completed.
3. skippedPushes is absent from the summary parts list in printSyncReport (integration.ts:548-560) on BOTH paths, so it never appears in the one line an operator reads.

Net effect: the command an operator reaches for to diagnose a stuck mirror is the one command that cannot report why it is stuck. This is why #265 had to read .tbd/data-sync/bridge/ by hand.

Fix: populate report.skippedPushes in the dry-run branch from the same pair.result.skippedPushes the execute path reads, and add a 'skipped pushes N' part to the summary.
