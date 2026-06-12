---
type: is
id: is-01ktyewkf40ah21v6a2hek2h1n
title: "pathExists: stat or single read; do not swallow non-ENOENT errors"
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:14.660Z
updated_at: 2026-06-12T18:20:31.245Z
closed_at: 2026-06-12T18:20:31.245Z
close_reason: "Fixed in 83fe4bb: pathExists is stat-based, single read, propagates non-ENOENT errors."
---
[Phase 1] PR #169. doc-fork.ts:69-76 reads entire file to test existence and callers immediately re-read; non-ENOENT errors (permissions) read as 'absent'. Use stat, or read once and branch on ENOENT.
