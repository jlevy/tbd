---
type: is
id: is-01ksnga2my9rmrq6sre0c57p3j
title: "H4: Lock-boundary and first-use concurrency regression tests"
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies: []
parent_id: is-01ksng8cqv1885jwvg3fagcfph
created_at: 2026-05-27T19:59:13.054Z
updated_at: 2026-05-27T19:59:13.054Z
---
Tests for H1-H3. The second review specifically asked for these; existing golden coverage proves the happy path but not the lock boundary.
1. Concurrency regression test (new): run first-use READ commands (tbd list, tbd ready) concurrently from two linked worktrees against (a) an f03 repo and (b) an f04 repo with missing $GIT_COMMON_DIR/tbd/layout.yml. Assert exactly one shared worktree + one layout.yml is produced and NO legacy/direct .tbd/data-sync/ issue path is written. Model setup on the existing golden tryscript packages/tbd/tests/cli-shared-common-dir-worktree.tryscript.md and the linked-worktree helpers in packages/tbd/tests/worktree-health.test.ts.
2. Unit tests: ensureSharedDataSyncLayout (H1) runs only under the lock; the read fast-path skips the lock when layout+worktree are already valid and migrated===false.
3. doctor --fix test (H3): layout/config mismatch repair under lock + future-format surfacing.
4. Re-run full suite on the MERGED branch head (pnpm --filter get-tbd test and test:tryscript) — PR #121's green CI predates the main merge that refactored setup.ts/doctor.ts/status.ts/integration-paths.ts (PR #131). 
Acceptance: new tests fail against current code and pass after H1-H3; full unit + golden suite green on merged head.
