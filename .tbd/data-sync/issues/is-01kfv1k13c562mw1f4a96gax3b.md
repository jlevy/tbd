---
type: is
id: is-01kfv1k13c562mw1f4a96gax3b
title: "[PR#25] Fix cross-reference to non-existent implement-spec shortcut"
kind: task
status: closed
priority: 2
version: 7
labels:
  - bug
dependencies: []
created_at: 2026-01-25T17:00:26.091Z
updated_at: 2026-03-09T16:12:32.809Z
closed_at: 2026-01-25T17:01:21.754Z
close_reason: "Fixed: Changed cross-reference from implement-spec to implement-issues"
---
The new-implementation-beads-from-spec.md shortcut references 'implement-spec' but that shortcut doesn't exist. It should reference 'implement-issues' (after renaming).
