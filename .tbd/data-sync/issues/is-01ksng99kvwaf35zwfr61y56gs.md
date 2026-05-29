---
type: is
id: is-01ksng99kvwaf35zwfr61y56gs
title: "H1: Make loadDataContext() read path truly read-only (no unlocked mutation)"
kind: bug
status: closed
priority: 0
version: 6
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01ksng9a223hhdkb2tw3ew3wd4
  - type: blocks
    target: is-01ksnga2my9rmrq6sre0c57p3j
  - type: blocks
    target: is-01ksnga34m6xqq6msc4yp6asmx
parent_id: is-01ksng8cqv1885jwvg3fagcfph
created_at: 2026-05-27T19:58:47.419Z
updated_at: 2026-05-28T03:47:53.093Z
closed_at: 2026-05-28T03:47:53.092Z
close_reason: null
---
BLOCKING (second review). loadDataContext() at packages/tbd/src/cli/lib/data-context.ts:164 runs withDataSyncContext(tbdRoot, { lock: false }, ...), but the prepared path prepareDataSyncContext() (data-context.ts:87-137) is NOT read-only:
- readConfigWithMigration() migrates config in memory (data-context.ts:88).
- repairWorktree() runs for missing/prunable worktrees (data-context.ts:100) — MUTATES.
- writeCommonDirLayout() writes $GIT_COMMON_DIR/tbd/layout.yml (data-context.ts:120) — MUTATES.
- writeConfig() persists migrated .tbd/config.yml when migrated (data-context.ts:124) — MUTATES.
So read commands (tbd list/ready/search/blocked/stale/stats, attic/label/dep reads) can race f03->f04 migration, missing-layout init, legacy-worktree removal, and shared-worktree creation without $GIT_COMMON_DIR/tbd/locks/data-sync.lock. Easiest trigger: two agents (or agent+user) run benign reads from sibling worktrees right after upgrade/fresh clone.

Fix:
1. Add ensureSharedDataSyncLayout(tbdRoot, config, sharedPaths) holding the mutating steps (worktree repair, layout write, migrated config write). Only ever call it inside withSharedDataSyncLock. Reuse the currently-unused ensureCommonDirLayout() at packages/tbd/src/file/common-dir-layout.ts:110-121 as the layout half instead of duplicating read/validate/write inline.
2. Add a cheap validity probe: readCommonDirLayout() returns a layout that passes validateCommonDirLayout() against config, checkWorktreeHealth()==valid, and migrated===false. When the probe passes, loadDataContext resolves resolveDataSyncDir({allowFallback:false}) and loadIdMapping() with NO lock. When it fails, acquire withSharedDataSyncLock and run ensureSharedDataSyncLayout before resolving.
3. Keep withDataSyncContext(..., { lock: true }, ...) for writers unchanged (data-context.ts:143-153).
Acceptance: read commands take the lock only when first-use init/migrate/repair is actually needed; steady-state reads take no lock; exactly one shared worktree/layout is produced under concurrency. Covered by H4 tests.
