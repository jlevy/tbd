---
close_reason: Implemented documentation improvements
closed_at: 2026-01-17T10:56:04.137Z
created_at: 2026-01-17T10:41:56.586Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.001Z
    original_id: tbd-1919
id: is-01kf5zyg8p80z9x1ab1srxv31z
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: Add brief Sync Architecture section
type: is
updated_at: 2026-03-09T16:12:30.522Z
version: 6
---
Add brief section explaining how sync works for users who want to understand. Key points: dedicated tbd-sync branch (not main), never pollutes feature branches, content-hash conflict detection, automatic field-level merge (LWW for scalars, union for arrays), lost values preserved in attic.
