---
type: is
id: is-01ktxg4sk0w35mbmwpr73z5y19
title: "Phase 2: docs_cache.local_dirs + tbd docs add <docref> + grouped sync (per-source failure isolation)"
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels: []
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
created_at: 2026-06-12T08:45:57.216Z
updated_at: 2026-06-12T22:11:23.131Z
closed_at: 2026-06-12T22:11:23.131Z
close_reason: "Done in 3406821: tbd docs add <docref> (per-kind --add as aliases; canonical docref recorded; explicit @ref required for git docrefs; local docrefs offline; reference kind addable); docs_cache.local_dirs served between fork dir and cache, state local, provenance note, not forkable; sync grouped per git repo+ref with per-group failure isolation, one ls-remote revision capture per group (SyncResult.sourceRevisions), no pruning on fetch failure. Fixed two real bugs found en route: cache refresh dropped sibling docs_cache keys on config rewrite; effectiveServePaths double-sanitize emptied local dirs. New docs-add-local-dirs-e2e.test.ts (4 tests) + groupSourceEntries unit."
---
