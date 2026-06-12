---
type: is
id: is-01ktyew8tvzpbq1p6kes3n8f9m
title: "f05 definition drift: migration extras and fork_dir configurability vs spec"
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:03.771Z
updated_at: 2026-06-12T17:43:03.771Z
---
[Phase 1] PR #169. FORMAT_HISTORY.f05 omits docs_cache.fork_dir/local_dirs and the generated .tbd/README.md that the spec defines as f05; migrate_f04_to_f05 is stamp-only (no .tbd/.gitignore refresh, no .tbd/README.md); FORK_DIR is a hard constant (paths.ts:361) contradicting Resolved Decision 6. Either implement within the f05 era or amend the spec so f05 means what it stamps. Also: migration reorders config keys (lookup_path moved) - keep the stamp diff minimal.
