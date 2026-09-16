---
type: is
id: is-01m2kfdbt06nedkf82tj5r5qyv
title: issues/.gitattributes (*.md merge=binary) never reaches existing repositories; only a fresh worktree writes it
kind: bug
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-15T21:26:19.710Z
updated_at: 2026-09-16T06:38:26.573Z
closed_at: 2026-09-16T06:38:26.572Z
close_reason: "Implemented and merged to main with green PR CI: tbd-yqq7 in #292 (705f70c0), tbd-evn3 in #293 (05f7eb66), and tbd-80vz in #294 (7120d16f). Verified against origin/main during the 2026-09-15 release-readiness audit."
resolution: null
duplicate_of: null
---
`ensureDataSyncScaffold` (packages/tbd/src/file/git.ts:2112-2142) is the only writer of `.tbd/data-sync/issues/.gitattributes` (`*.md merge=binary`), added in PR #288 (a0f4d629) so every two-sided bead edit reaches the structured merge instead of git's line merge.

It never runs on an already-initialized repository: `cli/lib/data-context.ts:161` calls `initWorktree` only when `isDataSyncScaffoldReady` is false (meta.yml missing, git.ts:2178-2188); setup calls it only from `initializeTbd` (fresh setup and Beads migration, setup.ts:1746, :1859, :1979); doctor and `repairWorktree` only for a missing, prunable, or corrupted worktree. Normal `tbd sync` and `tbd setup --auto` never add it. By contrast, `mappings/.gitattributes` is rewritten before every merge (sync.ts:1267-1287).

Evidence: this repository's `origin/tbd-sync` (4684bb12) has `mappings/.gitattributes` but no `issues/.gitattributes`.

Failure scenario (the R2 repro from the #288 review): on an upgraded repo, clone A relinks a bead to a new provider issue while clone B queues a comment on the old link, with the hunks far enough apart. Git line-merges cleanly, producing a namespace no writer would produce (new id and key, old url, a comment for the old issue), reported as a clean sync with nothing archived. Today this mostly needs a hand edit or foreign tool, since tbd writers bump `updated_at`.

Side effects: adoption is accidental. Any clone that creates a fresh worktree on an existing repo commits "Initialize tbd-sync data layout" just for this file, which then rides tbd-sync to everyone. tbd-design.md (~2630-2636) says the attribute is on the sync branch, which is false for upgraded repos.

Fix: write the attribute before every merge, mirroring the sync.ts:1267 block; add an upgraded-repo tryscript (repo created by 0.8.1, upgraded, two-sided edit goes through `mergeBeadAcrossRefs`). T4 (`validateCrossVersionCoexistence`) does not exercise a 0.8.1 client merging a two-sided edit under `merge=binary`; extend it or record why 0.8.1 is safe (it merges from refs).

Found in the 2026-09-15 release-readiness review of main @ 1238038e (verified by reading the code). Release 1 gate.

## Notes

2026-09-15: PR #292 (https://github.com/jlevy/tbd/pull/292), branch fix/issues-gitattributes-upgraded-repos, not merged.

Root cause confirmed. With `issues/.gitattributes` removed from both clones' tbd-sync branches (the state 0.8.1 leaves), a quiet relink vs. queued-comment edit line-merged: the comment was carried onto the new link and nothing was archived. Git reads merge attributes from the merging worktree. On unfixed main, Session B's fresh worktree adopted the file via the scaffold, and Session A still line-merged.

Fix: `ensureDataSyncMergeAttributes` (file/git.ts) writes a missing attribute file and commits it once. Sync calls it on every full sync, replacing the inline mappings block, and at the top of `mergeRemoteIntoSyncBranch`, because a rejected `tbd sync --push` merges there without passing through the full sync. tbd-design.md §3.4 and the data-sync trees are corrected.

Tests: cli-sync-merge-attributes-upgraded-repo.tryscript.md (red 4/9 before the fix; with only the merge-time call removed, the `--push` half was red 3/13) and data-sync-merge-attributes.test.ts.

T4 not extended; the reason is in the PR. 0.7.0/0.7.1/0.8.0/0.8.1 resolve every unmerged bead via `git diff --diff-filter=U` plus `mergeBeadAcrossRefs(HEAD, MERGE_HEAD)`, and CLI writers bump `updated_at`, so a CLI-driven T4 step would not test the attribute.

CI: all 7 checks green, including the upgrade proof and the tryscripts in Coverage & Lint. Leave open until merge.
