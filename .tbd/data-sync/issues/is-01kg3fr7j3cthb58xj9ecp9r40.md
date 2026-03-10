---
type: is
id: is-01kg3fr7j3cthb58xj9ecp9r40
title: "Add architectural test: issues written to worktree path"
kind: task
status: closed
priority: 2
version: 9
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3frbqa3wwzr0sbqpps1hxz
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:41:52.066Z
updated_at: 2026-03-09T16:12:33.253Z
closed_at: 2026-01-29T01:17:05.227Z
close_reason: "Added 3 architectural tests verifying issues are written to worktree path: resolveDataSyncDir returns worktree path, issues written via resolved path exist in worktree not direct path, WorktreeMissingError thrown when fallback disabled"
---
Add test per spec that verifies: after tbd init + create, issues exist in .tbd/data-sync-worktree/.tbd/data-sync/issues/ and NOT in .tbd/data-sync/issues/. This prevents regression of the core bug.
