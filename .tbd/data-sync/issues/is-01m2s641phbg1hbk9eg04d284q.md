---
type: is
id: is-01m2s641phbg1hbk9eg04d284q
title: "Merge stack 312 (#309 then #310) when github-merge and B3 confirmation are given"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
child_order_hints:
  - is-01m2sfsd4qhzvazyfw295bpzxy
created_at: 2026-09-18T02:39:23.857Z
updated_at: 2026-09-18T06:01:25.873Z
---
Both PRs are merge-ready. Do not merge until (1) github-merge is granted for these PRs and (2) the user names each of the seven policy-block grants (D6 / B3): github-workflows: granted, github-editing: granted, github-merge: per-request, github-stacked-prs: granted, subagents: granted, pr-review-requirements: standard, linear: epics + specs. Merge #309 into main first, then #310 (base is claude/pr-review-lifecycle-and-delegation). Current heads: #309 0f26a4bca4e9fbc901416410749fb64cc5664fd8 CI 35311175845 (all 8 green); #310 a35d1e0fc597539d36cfd57ff989d42581fed3bc CI 35311375206 (all 8 green). Formal stack 312. All marked reviews (309 A/B/C/D, 310 A/B, Bugbot) have disposition replies. Deferred child: tbd-px37 (D6).
