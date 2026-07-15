---
type: is
id: is-01kv1cyr0xsdj1gvkkmjjzgj15
title: Quiet contract + suppress incidental notices
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv199hk1mhj4qq0c1rhhkh31
created_at: 2026-06-13T21:07:11.005Z
updated_at: 2026-06-14T16:06:52.622Z
closed_at: 2026-06-14T16:06:52.622Z
close_reason: getCommandContext mirrors --quiet process-wide (context.ts quietNoticesActive/setQuietNotices); notifyWorktreeRepaired and notifyConfigMigrated early-return under it. Covers all callers without threading through withDataSyncContext. Tests in quiet-notices.test.ts. Committed on this branch.
---
Keep --quiet silent on success (preserve quiet-create golden). Suppress worktree-heal and config-migration stderr notices under --quiet so agents no longer need 2>&1 | tail -1. Add goldens for text vs quiet vs json.
