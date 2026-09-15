---
type: is
id: is-01m2kfdbt06nedkf82tj5r5qyv
title: issues/.gitattributes (*.md merge=binary) never reaches existing repositories; only a fresh worktree writes it
kind: bug
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-15T21:26:19.710Z
updated_at: 2026-09-15T21:27:01.588Z
---
`ensureDataSyncScaffold` (packages/tbd/src/file/git.ts:2112-2142) is the only writer of `.tbd/data-sync/issues/.gitattributes` (`*.md merge=binary`), added in PR #288 (a0f4d629) so every two-sided bead edit reaches the structured merge instead of git's line merge.

It never runs on an already-initialized repository: `cli/lib/data-context.ts:161` calls `initWorktree` only when `isDataSyncScaffoldReady` is false (meta.yml missing, git.ts:2178-2188); setup calls it only from `initializeTbd` (fresh setup and Beads migration, setup.ts:1746, :1859, :1979); doctor and `repairWorktree` only for a missing, prunable, or corrupted worktree. Normal `tbd sync` and `tbd setup --auto` never add it. By contrast, `mappings/.gitattributes` is rewritten before every merge (sync.ts:1267-1287).

Evidence: this repository's `origin/tbd-sync` (4684bb12) has `mappings/.gitattributes` but no `issues/.gitattributes`.

Failure scenario (the R2 repro from the #288 review): on an upgraded repo, clone A relinks a bead to a new provider issue while clone B queues a comment on the old link, with the hunks far enough apart. Git line-merges cleanly, producing a namespace no writer would produce (new id and key, old url, a comment for the old issue), reported as a clean sync with nothing archived. Today this mostly needs a hand edit or foreign tool, since tbd writers bump `updated_at`.

Side effects: adoption is accidental. Any clone that creates a fresh worktree on an existing repo commits "Initialize tbd-sync data layout" just for this file, which then rides tbd-sync to everyone. tbd-design.md (~2630-2636) says the attribute is on the sync branch, which is false for upgraded repos.

Fix: write the attribute before every merge, mirroring the sync.ts:1267 block; add an upgraded-repo tryscript (repo created by 0.8.1, upgraded, two-sided edit goes through `mergeBeadAcrossRefs`). T4 (`validateCrossVersionCoexistence`) does not exercise a 0.8.1 client merging a two-sided edit under `merge=binary`; extend it or record why 0.8.1 is safe (it merges from refs).

Found in the 2026-09-15 release-readiness review of main @ 1238038e (verified by reading the code). Release 1 gate.
