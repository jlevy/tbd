---
type: is
id: is-01m1yzxzdmp51n509k6sgmgybw
title: "tbd -C <path>: select a repository without cd"
kind: feature
status: open
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-4
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:58.224Z
updated_at: 2026-09-16T08:24:08.686Z
extensions:
  linear:
    id: bc859d97-a3ca-43ca-a750-c1cdb0dfae2b
    linked_at: 2026-09-16T08:24:08.686Z
---
GH #204 follow-on. The only way to select a repository is cd, which is how misresolution happens (a cd inside a compound shell command persists across separators). Mirror git -C: resolve the tbd root from <path> instead of cwd for the one invocation. tbd web <path> already accepts a path.
