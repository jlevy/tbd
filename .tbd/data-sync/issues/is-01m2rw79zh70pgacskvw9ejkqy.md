---
type: is
id: is-01m2rw79zh70pgacskvw9ejkqy
title: "Stack 312 merge-ready: review and address PR #309 and #310"
kind: task
status: in_progress
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
child_order_hints:
  - is-01m2s0931f97gk8wray80g0deg
hold: null
hold_until: null
created_at: 2026-09-17T23:46:24.881Z
updated_at: 2026-09-18T00:57:17.615Z
started_at: 2026-09-17T23:46:31.869Z
---
Coordinator request in merge-ready mode (no merge). User asked to check out PR #310, do a senior engineering review of the stack, use the new PR review workflows from #309/#310, then delegate addressing to sub-agents, and confirm the stack is reviewed and complete.

Authorization (verbatim): "you can use the actual new PR review workflows that are part of this PR and the one above it"; "Your engineering review and then the delegation to other sub-agents to address the PR reviews"; "make sure everything is completed end-to-end as well as reviewed."

Formal GitHub stack 312 (#309 then #310). gh-stack is not installed; github-stacked-prs is unanswered on main — do not install the extension.

Pinned: #309 head 1485f045b93f0f409cf35332499d538fe4d7b669 (reviews A+B published, unaddressed). #310 head dbd1c9a85910951b3a3c58cb891efc42c6cca15d (no marked review; Bugbot unmarked; Coverage & Lint red; not an ancestor of current #309 after #309 merged main).
