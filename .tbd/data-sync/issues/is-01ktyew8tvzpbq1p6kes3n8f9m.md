---
type: is
id: is-01ktyew8tvzpbq1p6kes3n8f9m
title: "f05 definition drift: migration extras and fork_dir configurability vs spec"
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:03.771Z
updated_at: 2026-06-12T20:25:42.878Z
closed_at: 2026-06-12T20:25:42.877Z
close_reason: "Done in 3c718c0: spec now describes f05 as the stamp-only migration FORMAT_HISTORY records (authoritative), with .tbd/.gitignore refresh, generated .tbd/README.md, and docs_cache.fork_dir configurability reframed as additive in-era work; fork dir documented as fixed at docs/tbd with paths.ts the single source of truth. Residual cosmetic: migration write reorders config keys (lookup_path moved) — noted, not a contract violation."
---
[Phase 1] PR #169. FORMAT_HISTORY.f05 omits docs_cache.fork_dir/local_dirs and the generated .tbd/README.md that the spec defines as f05; migrate_f04_to_f05 is stamp-only (no .tbd/.gitignore refresh, no .tbd/README.md); FORK_DIR is a hard constant (paths.ts:361) contradicting Resolved Decision 6. Either implement within the f05 era or amend the spec so f05 means what it stamps. Also: migration reorders config keys (lookup_path moved) - keep the stamp diff minimal.
