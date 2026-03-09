---
close_reason: null
closed_at: 2026-01-17T05:00:00.000Z
created_at: 2026-01-15T22:45:01.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.182Z
    original_id: tbd-1807
id: is-01kf5zyg8mrspt4ggcpyt6me8n
kind: bug
labels:
  - ci
  - phase-17
  - speculate
  - windows
parent_id: null
priority: 2
status: closed
title: Windows CI excluded due to colon in filenames
type: is
updated_at: 2026-03-09T02:47:21.208Z
version: 5
---
Windows CI is excluded from test matrix because docs/general contains files with : in names (shortcut:*.md) which is invalid on Windows. Fixed by renaming to shortcut- prefix.
