---
type: is
id: is-01kzrxh9k07qj7gz48x0n7kj00
title: "R4: Preserve web wake baseline across transient apply failures"
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
created_at: 2026-08-11T17:22:15.263Z
updated_at: 2026-08-11T18:03:03.533Z
closed_at: 2026-08-11T18:03:03.533Z
close_reason: Implemented with focused regressions; full Vitest (1496) and tryscript (1073) matrices, build, lint, and package proofs are green.
---
WakeCoordinator currently drops watchSince after any report-handling failure. A transient runIssueSync or reload failure can therefore re-establish at the already-seen remote tip and skip applying that report forever. Keep the prior baseline so the same report is retried; reset only when watch explicitly proves the baseline is not an ancestor after a sync-history rewrite. Add regression coverage for both paths.
