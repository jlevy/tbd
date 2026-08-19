---
type: is
id: is-01kzrxt1zjbxhfv0t5wmbqq6df
title: "R6: Tear down watcher when the web listener closes"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - code-review
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T17:27:02.383Z
updated_at: 2026-08-11T18:03:03.548Z
closed_at: 2026-08-11T18:03:03.548Z
close_reason: Implemented with focused regressions; full Vitest (1496) and tryscript (1073) matrices, build, lint, and package proofs are green.
---
WebHandler returns success when WebServerHandle.closed resolves without calling handle.close(), which can leave the fs watcher and remote task alive after an unexpected listener close. Always invoke idempotent close for both signal and listener-close outcomes and add lifecycle coverage at the server/handler seam.
