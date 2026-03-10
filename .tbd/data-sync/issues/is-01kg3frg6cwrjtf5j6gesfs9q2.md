---
type: is
id: is-01kg3frg6cwrjtf5j6gesfs9q2
title: Update init/setup to verify worktree after creation
kind: task
status: closed
priority: 2
version: 8
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:42:00.907Z
updated_at: 2026-03-09T16:12:33.264Z
closed_at: 2026-01-29T01:18:36.885Z
close_reason: Added checkWorktreeHealth() verification after worktree creation in init.ts and setup.ts. Both commands now warn if worktree creation succeeded but verification fails, pointing users to 'tbd doctor' for diagnosis.
---
Update setup.ts and init.ts to call checkWorktreeHealth() after worktree creation and report error if creation failed. Prevents silent failures during initialization. Location: packages/tbd/src/cli/commands/setup.ts, init.ts
