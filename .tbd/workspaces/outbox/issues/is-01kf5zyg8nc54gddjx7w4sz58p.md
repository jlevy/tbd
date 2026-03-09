---
close_reason: "Added ID format helpers: isValidShortIdFormat, isValidInternalIdFormat, isDisplayIdNotInternal"
closed_at: 2026-01-16T18:54:29.942Z
created_at: 2026-01-16T18:46:36.696Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.410Z
    original_id: tbd-1838
id: is-01kf5zyg8nc54gddjx7w4sz58p
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Add test helper: strict ID format validation"
type: is
updated_at: 2026-03-09T02:47:21.406Z
version: 5
---
Replace loose [SHORTID] regex with strict validation: must be exactly 4-5 alphanumeric chars, not 26-char ULIDs. Used to catch bugs like tbd-1811.
