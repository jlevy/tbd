---
type: is
id: is-01kzrywdcr0d9n2z9yfk6vcepp
title: "R8: Bound rescue integration test under full-suite load"
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
created_at: 2026-08-11T17:45:48.183Z
updated_at: 2026-08-11T18:03:03.560Z
closed_at: 2026-08-11T18:03:03.560Z
close_reason: Implemented with focused regressions; full Vitest (1496) and tryscript (1073) matrices, build, lint, and package proofs are green.
---
packages/tbd/tests/rescue-divergence.test.ts: the true-conflict rescue integration case relies on Vitest's 5s unit default. It passed alone in 0.7s but reached 8.4s while the full 5,000-issue and setup fixtures ran concurrently, making the final gate nondeterministic. Give this subprocess/Git integration case an explicit 20s timeout, rerun it, then rerun the complete suite.
