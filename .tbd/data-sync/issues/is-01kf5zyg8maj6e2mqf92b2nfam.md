---
type: is
id: is-01kf5zyg8maj6e2mqf92b2nfam
title: "Test: Add golden test for tbd uninstall command"
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T07:10:06.188Z
updated_at: 2026-03-09T16:12:29.861Z
closed_at: 2026-01-17T01:34:03.040Z
close_reason: Implemented in commit 11fbe51
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.273Z
    original_id: tbd-1820
---
Add tryscript golden test for tbd uninstall command - verify it removes .tbd/, deletes tbd-sync branch, requires confirmation without --yes flag.
