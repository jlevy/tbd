---
type: is
id: is-01m2s641phbg1hbk9eg04d284q
title: "Merge stack 312 (#309 then #310) when github-merge and B3 confirmation are given"
kind: task
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
child_order_hints:
  - is-01m2sfsd4qhzvazyfw295bpzxy
created_at: 2026-09-18T02:39:23.857Z
updated_at: 2026-09-18T17:23:12.936Z
---
Both layers are code-complete and CI-green after round 4. Heads: #309 d271d387fa00f3603b9ae7b798d4bb9bfea75801 (CI 35372350017), #310 4a85bdcc5bcfc866e35806770e00ded51eaf5df4 (CI 35372421859). Formal stack 312; merge #309 into main first, then #310. Do not merge until (1) github-merge is granted for these PRs and (2) the user confirms each of the seven policy-block values by name: github-workflows: granted, github-editing: granted, github-merge: per-request, github-stacked-prs: granted, subagents: granted, pr-review-requirements: standard, linear: epics + specs. Note from review F: linear: epics + specs is wider than --policies=recommended would write (that policy's recommended value is unset; its grant value is epics), so read it back verbatim.
