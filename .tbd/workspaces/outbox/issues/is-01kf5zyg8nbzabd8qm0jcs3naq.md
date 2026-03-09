---
close_reason: "Verified: Phase 23 init behavior implemented"
closed_at: 2026-01-17T09:52:22.239Z
created_at: 2026-01-17T06:06:39.798Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.669Z
    original_id: tbd-1874.1
id: is-01kf5zyg8nbzabd8qm0jcs3naq
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add requireInit() helper function
type: is
updated_at: 2026-03-09T16:12:30.228Z
version: 6
---
Create src/cli/lib/requireInit.ts with centralized init check that throws CLIError with message: Not a tbd repository (run 'tbd init' or 'tbd import --from-beads' first)
