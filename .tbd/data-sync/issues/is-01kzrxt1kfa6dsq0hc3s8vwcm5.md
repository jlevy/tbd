---
type: is
id: is-01kzrxt1kfa6dsq0hc3s8vwcm5
title: "R5: Bound and cancel tbd web sync pulls"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - code-review
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T17:27:01.998Z
updated_at: 2026-08-11T18:03:03.541Z
closed_at: 2026-08-11T18:03:03.541Z
close_reason: Implemented with focused regressions; full Vitest (1496) and tryscript (1073) matrices, build, lint, and package proofs are green.
---
WakeCoordinator aborts the remote watch on shutdown, but runIssueSync still performs an unbounded prompt-capable git fetch. Route embedded pulls through gitNoPromptWithTimeout with the coordinator AbortSignal, retain the existing CLI sync behavior, and cover the bounded dependency call and aborted apply path.
