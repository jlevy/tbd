---
type: is
id: is-01kzrzbmtrqmxm1xdnm2x4x0bb
title: "R9: Update top-level help golden for tbd web"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - final-review
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T17:54:07.319Z
updated_at: 2026-08-11T18:03:03.566Z
closed_at: 2026-08-11T18:03:03.566Z
close_reason: Implemented with focused regressions; full Vitest (1496) and tryscript (1073) matrices, build, lint, and package proofs are green.
---
packages/tbd/tests/cli-setup.tryscript.md still pins the pre-web top-level help output. Add the web command in its Views and Filtering section, rerun the focused transcript, then rerun the complete transcript matrix.
