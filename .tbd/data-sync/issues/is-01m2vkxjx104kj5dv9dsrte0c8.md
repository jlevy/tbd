---
type: is
id: is-01m2vkxjx104kj5dv9dsrte0c8
title: Refresh long-lived design docs for policy-pref PR review and merge
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies:
  - type: blocks
    target: is-01m2vm2f44xk8raej7v30n7d3t
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-19T01:19:01.025Z
updated_at: 2026-09-19T01:31:04.471Z
started_at: 2026-09-19T01:19:06.836Z
closed_at: 2026-09-19T01:31:04.471Z
close_reason: "Durable design/overview docs now state policy-pref merge/review: four-value github-merge, pr-review-requirements invariance, and the PR review lifecycle (lettered IDs, dispositions, merge gate). Landed on #309 as e40459f2; #310 rebased onto that head (6fdd9dec). README left as-is so tbd-eti9 can restructure it."
resolution: null
duplicate_of: null
---
Bring durable design/overview docs in line with the live policy and PR-review model:

- Policy grants are user-settable preferences in AGENTS.md, not hardcoded yes/no behavior
- github-merge is a four-value ladder (never, confirm-every, confirm-session, autonomous)
- pr-review-requirements is independent of every github-merge value
- Formal PR review lifecycle: lettered reviews, four dispositions, merge gate, stacked-PR merge rules

Primary files: tbd-design.md, tbd-docs.md, docs-overview.md. Do not rewrite shortcut recommendation paragraphs owned by the parallel review-compliance check.
