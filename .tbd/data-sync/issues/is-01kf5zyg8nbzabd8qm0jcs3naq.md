---
type: is
id: is-01kf5zyg8nbzabd8qm0jcs3naq
title: Add requireInit() helper function
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T06:06:39.798Z
updated_at: 2026-03-09T16:12:30.228Z
closed_at: 2026-01-17T09:52:22.239Z
close_reason: "Verified: Phase 23 init behavior implemented"
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.669Z
    original_id: tbd-1874.1
---
Create src/cli/lib/requireInit.ts with centralized init check that throws CLIError with message: Not a tbd repository (run 'tbd init' or 'tbd import --from-beads' first)
