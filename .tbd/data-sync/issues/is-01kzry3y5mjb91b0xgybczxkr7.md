---
type: is
id: is-01kzry3y5mjb91b0xgybczxkr7
title: "R7: Accept every valid tbd display ID in web detail lookups"
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
created_at: 2026-08-11T17:32:26.163Z
updated_at: 2026-08-11T18:03:03.553Z
closed_at: 2026-08-11T18:03:03.553Z
close_reason: Implemented with focused regressions; full Vitest (1496) and tryscript (1073) matrices, build, lint, and package proofs are green.
---
BoardState.getBead uses a public-id regex that excludes dot and underscore, but valid tbd prefixes and ShortId mappings permit those characters (and imported short IDs permit hyphens). Align validation with the canonical prefix/ShortId alphabets, retain the leading-option defense, and add a regression for a dotted/underscored display ID.
