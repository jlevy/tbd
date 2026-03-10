---
type: is
id: is-01kg3frmht6x09yzt08ddm20ys
title: Add warning in resolveDataSyncDir test mode fallback
kind: task
status: closed
priority: 3
version: 8
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:42:05.369Z
updated_at: 2026-03-09T16:12:33.269Z
closed_at: 2026-01-29T01:19:35.548Z
close_reason: Added debug-level warning in resolveDataSyncDir when falling back to direct path. Warning emits when DEBUG or TBD_DEBUG env vars are set, helping detect unintended fallback usage during development.
---
When resolveDataSyncDir({ allowFallback: true }) falls back to direct path, emit debug-level warning. Helps detect unintended fallback usage. Location: packages/tbd/src/lib/paths.ts
