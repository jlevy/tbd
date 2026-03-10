---
type: is
id: is-01kfv1k1bqa0j7mnvzqeg0sjxf
title: "[PR#25] Update root .gitignore to use current .tbd/ paths"
kind: task
status: closed
priority: 2
version: 7
labels:
  - bug
dependencies: []
created_at: 2026-01-25T17:00:26.358Z
updated_at: 2026-03-09T16:12:32.815Z
closed_at: 2026-01-25T17:01:22.000Z
close_reason: "Fixed: Removed old .tbd/cache/ and .tbd/sync-worktree/ paths, these are now in .tbd/.gitignore"
---
The root .gitignore has old paths: .tbd/cache/ and .tbd/sync-worktree/. These should be updated to current paths: .tbd/docs/, .tbd/state.yml, .tbd/data-sync-worktree/
