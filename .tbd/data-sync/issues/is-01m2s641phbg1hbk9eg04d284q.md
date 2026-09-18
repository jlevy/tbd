---
type: is
id: is-01m2s641phbg1hbk9eg04d284q
title: "Merge stack 312 (#309 then #310) when github-merge and B3 confirmation are given"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
child_order_hints:
  - is-01m2sfsd4qhzvazyfw295bpzxy
created_at: 2026-09-18T02:39:23.857Z
updated_at: 2026-09-18T05:36:15.966Z
---
Both PRs are merge-ready. Do not merge until (1) github-merge is granted for these PRs and (2) the user names each policy-block grant (B3). Merge #309 into main first, then #310 (base is claude/pr-review-lifecycle-and-delegation). Heads: #309 34db3783 CI 35299039050; #310 78665299 CI 35299048692.
