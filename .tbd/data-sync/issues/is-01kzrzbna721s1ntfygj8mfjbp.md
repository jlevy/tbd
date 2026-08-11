---
type: is
id: is-01kzrzbna721s1ntfygj8mfjbp
title: "R10: Isolate sandboxed tryscript Git remotes"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - final-review
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T17:54:07.814Z
updated_at: 2026-08-11T18:03:03.573Z
closed_at: 2026-08-11T18:03:03.573Z
close_reason: Implemented with focused regressions; full Vitest (1496) and tryscript (1073) matrices, build, lint, and package proofs are green.
---
Five sync tryscripts escape their sandbox into persistent ../origin.git. Their tbd-sync refs leak across scenarios, making the repository-wide CLI matrix order-dependent. Move each remote under its sandbox's own .git directory using an absolute PWD-derived path, validate all five affected transcripts together, and rerun the full matrix.
