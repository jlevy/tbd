---
type: is
id: is-01kgfy2t5wcmspjyfz7sc3ng1r
title: Standardize YAML error handling with parseYamlWithConflictDetection
kind: task
status: closed
priority: 2
version: 10
spec_path: docs/project/specs/done/plan-2026-02-02-skill-md-comprehensive-update.md
labels: []
dependencies: []
parent_id: is-01kgfy2a5tz9hx3b7twjg2est7
created_at: 2026-02-02T19:43:12.059Z
updated_at: 2026-09-14T04:20:15.876Z
closed_at: 2026-02-02T19:54:05.696Z
close_reason: Updated attic.ts to use parseYamlWithConflictDetection for synced attic entry files. search.ts and config.ts read local-only gitignored files that don't need merge conflict detection.
---
Replace direct parseYaml calls with parseYamlWithConflictDetection for user-editable files to provide helpful error messages for merge conflicts.
