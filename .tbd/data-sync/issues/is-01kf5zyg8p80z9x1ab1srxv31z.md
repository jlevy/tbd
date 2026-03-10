---
type: is
id: is-01kf5zyg8p80z9x1ab1srxv31z
title: Add brief Sync Architecture section
kind: task
status: closed
priority: 3
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T10:41:56.586Z
updated_at: 2026-03-09T16:12:30.522Z
closed_at: 2026-01-17T10:56:04.137Z
close_reason: Implemented documentation improvements
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.001Z
    original_id: tbd-1919
---
Add brief section explaining how sync works for users who want to understand. Key points: dedicated tbd-sync branch (not main), never pollutes feature branches, content-hash conflict detection, automatic field-level merge (LWW for scalars, union for arrays), lost values preserved in attic.
