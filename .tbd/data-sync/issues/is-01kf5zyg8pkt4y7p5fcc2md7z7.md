---
type: is
id: is-01kf5zyg8pkt4y7p5fcc2md7z7
title: Remove all one-letter CLI option aliases
kind: epic
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T11:03:40.045Z
updated_at: 2026-03-09T16:12:30.581Z
closed_at: 2026-01-17T11:50:25.206Z
close_reason: Closed
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.068Z
    original_id: tbd-1928
---
Systematically remove all one-letter option aliases from the TBD CLI. These short options are error-prone and the full-word versions are clear enough to type.

One-letter options to remove:
- tbd-1922: -V → --version
- tbd-1923: -t → --type
- tbd-1924: -p → --priority
- tbd-1925: -d → --description
- tbd-1926: -f → --file
- tbd-1927: -l → --label

Total: 6 options across 2 files (cli.ts and create.ts)
