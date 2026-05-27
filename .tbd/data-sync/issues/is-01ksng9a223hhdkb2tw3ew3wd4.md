---
type: is
id: is-01ksng9a223hhdkb2tw3ew3wd4
title: "H2: Centralize direct init/repair behind one locked ensure entry point"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01ksnga2my9rmrq6sre0c57p3j
parent_id: is-01ksng8cqv1885jwvg3fagcfph
created_at: 2026-05-27T19:58:47.874Z
updated_at: 2026-05-27T19:59:30.758Z
---
HIGH-priority (second review). Direct init/repair callers bypass the shared lock; initWorktree() runs migrateLegacyWorktreesToShared() (packages/tbd/src/file/git.ts:1124, defined at git.ts:1065; initWorktree at git.ts:1107), so they perform legacy migration + branch/worktree mutation unlocked:
- tbd init: packages/tbd/src/cli/commands/init.ts:176 initWorktree(cwd, remote, syncBranch).
- fresh tbd setup --auto: packages/tbd/src/cli/commands/setup.ts:1668 initWorktree(cwd).
- tbd doctor --fix: packages/tbd/src/cli/commands/doctor.ts:885 repairWorktree(...) and doctor.ts:971 initWorktree(cwd).
GOOD MODEL to mirror: setup.ts:1306 already wraps init in withDataSyncContext({lock:true}) (the f03->f04 migration path).

Fix: route every init/migrate/repair caller through one internal 'ensure shared sync layout under lock' entry point (the ensureSharedDataSyncLayout from H1, or a thin wrapper). If initWorktree()/repairWorktree() (git.ts:1107/1511) stay public for tests, document that they require an outer lock and wrap each CLI caller in withSharedDataSyncLock(). 
Acceptance: no init.ts/setup.ts/doctor.ts path runs initWorktree/repairWorktree/migrateLegacyWorktreesToShared without holding the shared lock.
