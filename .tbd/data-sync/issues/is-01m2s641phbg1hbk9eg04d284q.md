---
type: is
id: is-01m2s641phbg1hbk9eg04d284q
title: "Merge stack 312 (#309 then #310) when github-merge and B3 confirmation are given"
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
child_order_hints:
  - is-01m2sfsd4qhzvazyfw295bpzxy
created_at: 2026-09-18T02:39:23.857Z
updated_at: 2026-09-18T19:44:35.809Z
---
Both layers are code-complete and CI-green as of round 4, plus the github-merge redesign in round 5. Heads: #309 eca9187ca0260a48bf8cb6f76219141d93c0163d, #310 372d18ec42a3c959175cbab490d20594f82f4bce. Formal stack 312; merge #309 into main first, then #310. Do not merge until (1) github-merge permits it and (2) the user confirms each of the seven policy-block values by name. The block now records github-merge: confirm-session (was per-request), so the confirmation list is: github-workflows: granted, github-editing: granted, github-merge: confirm-session, github-stacked-prs: granted, subagents: granted, pr-review-requirements: standard, linear: epics + specs. Note: linear: epics + specs is wider than --policies=recommended would write (that policy's recommended value is unset; its grant value is epics), so read it back verbatim. Round 5 review H is in flight on the vocabulary delta and must be addressed before the merge gate is rechecked.
