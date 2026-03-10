---
type: is
id: is-01kf5zyg8m60b9q4vg366nw3gt
title: "Bug: tbd list shows 'no issues' instead of init prompt when not initialized"
kind: bug
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T07:07:21.298Z
updated_at: 2026-03-09T16:12:29.831Z
closed_at: 2026-01-16T19:59:54.968Z
close_reason: Fixed by adding initialization check in list command
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.194Z
    original_id: tbd-1809
---
When running 'tbd list' without first running 'tbd init', the command shows 'no issues' instead of a helpful message like 'tbd is not initialized. Run tbd init first.' The listIssues function returns an empty array instead of detecting the uninitialized state.
