---
type: is
id: is-01kf5zyg8nc54gddjx7w4sz58p
title: "Add test helper: strict ID format validation"
kind: task
status: closed
priority: 1
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T18:46:36.696Z
updated_at: 2026-03-09T16:12:30.239Z
closed_at: 2026-01-16T18:54:29.942Z
close_reason: "Added ID format helpers: isValidShortIdFormat, isValidInternalIdFormat, isDisplayIdNotInternal"
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.410Z
    original_id: tbd-1838
---
Replace loose [SHORTID] regex with strict validation: must be exactly 4-5 alphanumeric chars, not 26-char ULIDs. Used to catch bugs like tbd-1811.
