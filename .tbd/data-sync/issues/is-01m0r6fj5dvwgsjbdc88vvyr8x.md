---
type: is
id: is-01m0r6fj5dvwgsjbdc88vvyr8x
title: "PR #258 review R19: distinguish noisy timing gates from controlled regressions"
kind: bug
status: closed
priority: 2
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wdr6nrtymyeq46b5qnjr
created_at: 2026-08-23T20:55:03.085Z
updated_at: 2026-08-23T21:21:56.751Z
closed_at: 2026-08-23T21:21:56.751Z
close_reason: Fixed in a55041a0 with focused documentation corrections and regression coverage where executable.
---
packages/tbd/docs/guidelines/ci-and-gates-rules.md. The blanket claim that timing never belongs in a gate rules out dedicated runners and within-run regression comparisons. Scope the warning to uncontrolled absolute wall-clock thresholds and state when performance can be gated honestly.
