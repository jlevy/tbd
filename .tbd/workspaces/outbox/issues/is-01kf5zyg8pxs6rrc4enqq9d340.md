---
close_reason: Implemented documentation improvements
closed_at: 2026-01-17T10:56:04.137Z
created_at: 2026-01-17T10:41:51.114Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.996Z
    original_id: tbd-1918
id: is-01kf5zyg8pxs6rrc4enqq9d340
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: Add Priority and Date format reference
type: is
updated_at: 2026-03-09T02:47:21.809Z
version: 5
---
Add reference for priority scale and date formats:

### Priority Scale
| Value | Notation | Meaning |
|-------|----------|---------|
| 0 | P0 | Critical - drop everything |
| 1 | P1 | High - this sprint |
| 2 | P2 | Medium - soon (default) |
| 3 | P3 | Low - backlog |
| 4 | P4 | Lowest - maybe/someday |

### Date Formats (for --due, --defer)
| Format | Example | Result |
|--------|---------|--------|
| Full datetime | 2025-02-15T10:00:00Z | Exact time |
| Date only | 2025-02-15 | Midnight UTC |
| Relative | +7d | 7 days from now |
| Relative | +2w | 2 weeks from now |
