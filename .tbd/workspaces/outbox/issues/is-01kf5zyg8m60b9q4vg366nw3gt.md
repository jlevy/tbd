---
close_reason: Fixed by adding initialization check in list command
closed_at: 2026-01-16T19:59:54.968Z
created_at: 2026-01-16T07:07:21.298Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.194Z
    original_id: tbd-1809
id: is-01kf5zyg8m60b9q4vg366nw3gt
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: "Bug: tbd list shows 'no issues' instead of init prompt when not initialized"
type: is
updated_at: 2026-03-09T02:47:21.004Z
version: 5
---
When running 'tbd list' without first running 'tbd init', the command shows 'no issues' instead of a helpful message like 'tbd is not initialized. Run tbd init first.' The listIssues function returns an empty array instead of detecting the uninitialized state.
