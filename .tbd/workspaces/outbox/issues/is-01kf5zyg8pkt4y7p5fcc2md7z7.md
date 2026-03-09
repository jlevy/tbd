---
close_reason: Closed
closed_at: 2026-01-17T11:50:25.206Z
created_at: 2026-01-17T11:03:40.045Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.068Z
    original_id: tbd-1928
id: is-01kf5zyg8pkt4y7p5fcc2md7z7
kind: epic
labels: []
parent_id: null
priority: 2
status: closed
title: Remove all one-letter CLI option aliases
type: is
updated_at: 2026-03-09T02:47:21.713Z
version: 5
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
