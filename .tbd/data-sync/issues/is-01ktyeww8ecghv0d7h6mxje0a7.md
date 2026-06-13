---
type: is
id: is-01ktyeww8ecghv0d7h6mxje0a7
title: "Cleanup: dead noop UpdateAction; GNU-only sed -i in update tryscript"
kind: task
status: closed
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:23.662Z
updated_at: 2026-06-12T18:20:34.850Z
closed_at: 2026-06-12T18:20:34.850Z
close_reason: "Fixed in 83fe4bb + e8b5112: dead noop UpdateAction removed (with its one reference); update tryscript uses portable perl -pi instead of GNU-only sed -i."
---
[Phase 3] PR #169. UpdateAction 'noop' is never returned; cli-docs-update.tryscript.md uses sed -i (GNU form) which fails when run locally on macOS (CI-only on ubuntu today). Use a portable edit (perl -pi or printf rewrite).
