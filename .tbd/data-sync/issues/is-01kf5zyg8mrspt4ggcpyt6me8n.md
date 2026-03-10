---
type: is
id: is-01kf5zyg8mrspt4ggcpyt6me8n
title: Windows CI excluded due to colon in filenames
kind: bug
status: closed
priority: 2
version: 6
labels:
  - ci
  - phase-17
  - speculate
  - windows
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-15T22:45:01.000Z
updated_at: 2026-03-09T16:12:30.054Z
closed_at: 2026-01-17T05:00:00.000Z
close_reason: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.182Z
    original_id: tbd-1807
---
Windows CI is excluded from test matrix because docs/general contains files with : in names (shortcut:*.md) which is invalid on Windows. Fixed by renaming to shortcut- prefix.
