---
type: is
id: is-01m2vmvgct4cb7vag3p6w96hc7
title: "PR #309 review I2: §6.4.9 default round omits dedicated reviews"
kind: bug
status: in_progress
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2vmva9sbfzx7k0mrh45kbkf
hold: null
hold_until: null
created_at: 2026-09-19T01:35:21.498Z
updated_at: 2026-09-19T01:35:27.915Z
started_at: 2026-09-19T01:35:27.915Z
---
packages/tbd/docs/tbd-design.md:5908. 'One senior engineering review and one addressing pass is the default round' omits that under standard a sensitive PR also gets dedicated security/performance/correctness passes. Inconsistent with pr-review-workflows and agent-policy-grants.
