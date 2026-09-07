---
type: is
id: is-01m1yzxdnqr4h9q88qqq6wpx4h
title: "resolveSpecLocation: one resolver classifying a stored spec_path; specs.dir config"
kind: feature
status: open
priority: 1
version: 7
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
updated_at: 2026-09-07T22:31:42.337Z
---
Root cause 1 of the sprint plan. spec_path is validated once at write time by resolveSpecArg (project-paths.ts:263-290, fs only, SPEC_SEARCH_ROOT 'docs' at :229) and never afterward; the only git-backed existence check is findBranchContaining (permalink.ts:75-90). Add lib/spec-lifecycle.ts with resolveSpecLocation(storedPath) returning present | moved (exactly one file with that basename elsewhere under the specs dir) | ambiguous (several) | on-branch (git ls-tree over refs/heads and refs/remotes finds it; bounded, cached per run) | missing. Config specs.dir, default docs/project/specs; lifecycle folder = first segment beneath it. Doctor, tbd spec status, list --specs, write-time validation and spec move all call this one function. Pure unit tests over a fixture tree for all five classes.
