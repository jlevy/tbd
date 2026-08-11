---
type: is
id: is-01kzrwbnfxtqwz2kryngexmqcf
title: "PR #207 review R2: bound Expand all detail-fetch concurrency"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - review
  - web
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T17:01:42.268Z
updated_at: 2026-08-11T18:03:03.504Z
closed_at: 2026-08-11T18:03:03.504Z
close_reason: Implemented with focused regressions; full Vitest (1496) and tryscript (1073) matrices, build, lint, and package proofs are green.
---
src/web/core.ts ClientStore.setExpanded() currently calls loadBody() for every visible row. At MAX_BOARD_ROWS=4,000, Expand all can fan out thousands of simultaneous /api/bead requests, stressing browser and loopback server resources. Add a bounded queue, preserve the stale-generation race guarantees from tbd-x8g8, prune queued work when rows collapse, and cover the concurrency ceiling with a deterministic transport test.
