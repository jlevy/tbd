---
type: is
id: is-01m1yzxzdmp51n509k6sgmgybw
title: "tbd -C <path>: select a repository without cd"
kind: feature
status: open
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-4
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:58.224Z
updated_at: 2026-09-07T22:31:45.651Z
---
GH #204 follow-on. The only way to select a repository is cd, which is how misresolution happens (a cd inside a compound shell command persists across separators). Mirror git -C: resolve the tbd root from <path> instead of cwd for the one invocation. tbd web <path> already accepts a path.
