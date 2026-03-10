---
type: is
id: is-01kf5zyg8p5yxd6v336cjb69rf
title: Remove golden scenario YAML tests in favor of tryscripts
kind: epic
status: closed
priority: 3
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T09:58:49.954Z
updated_at: 2026-03-09T16:12:30.463Z
closed_at: 2026-01-17T10:16:17.877Z
close_reason: Already migrated in commit 89528ad - all YAML scenarios covered by tryscripts
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.902Z
    original_id: tbd-1905
---
Migrate all tests/golden/scenarios/*.yaml tests to tryscript format, verify coverage, then delete the YAML files and potentially the golden test infrastructure
