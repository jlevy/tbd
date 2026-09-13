---
type: is
id: is-01m1yzxdnqr4h9q88qqq6wpx4h
title: "resolveSpecLocation: one resolver classifying a stored spec_path; specs.dir config"
kind: feature
status: open
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-2
dependencies:
  - type: blocks
    target: is-01m1yzxfatdcswww2sm93j0djm
  - type: blocks
    target: is-01m1yzxgm4mb8az2mxy9dggpjk
  - type: blocks
    target: is-01m1yzxjanhry6w9ns0dpppq6h
  - type: blocks
    target: is-01m1yzxm8735zgxvmxgqy5k5wb
  - type: blocks
    target: is-01m1yzxq2t7vye2fhe3t2pj0fh
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:40.051Z
updated_at: 2026-09-13T23:17:44.548Z
---
Root cause 1 of the sprint plan. spec_path is validated once at write time by resolveSpecArg (project-paths.ts:263-290, fs only, SPEC_SEARCH_ROOT 'docs' at :229) and never afterward; the only git-backed existence check is findBranchContaining (permalink.ts:75-90). Add lib/spec-lifecycle.ts with resolveSpecLocation(storedPath) returning present | moved (exactly one file with that basename elsewhere under the specs dir) | ambiguous (several) | on-branch (git ls-tree over refs/heads and refs/remotes finds it; bounded, cached per run) | missing. Config specs.dir, default docs/project/specs; lifecycle folder = first segment beneath it. Doctor, tbd spec status, list --specs, write-time validation and spec move all call this one function. Pure unit tests over a fixture tree for all five classes.

Revision 2026-09-13 (plan review against main and PRs #278-#283): Classify against the trunk ref (origin default branch) with the working tree only as an overlay; otherwise results flap between checkouts (36 beads already point at done/ paths that exist only on PR #283's branch). Order must be present, then moved, then on-branch, or a stale active/ path on an old branch reads as on-branch. Use one `git cat-file --batch-check` over ref:path pairs (about 1s for 8,745 pairs) rather than per-ref ls-tree (about 4 minutes measured). Count only refs not merged into trunk and show their age. Folders in this repo: active, backlog, current, done, paused, plus archive from PR #278; no future. The write-time search covers docs/ while the resolver scans specs.dir, so a moved research doc cannot classify as moved.
