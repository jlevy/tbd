---
type: is
id: is-01m1vtap5bmx36expphmmyyh3j
title: Canonicalize comment aliases and handle same-ID content conflicts deterministically
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-06T16:55:19.979Z
updated_at: 2026-09-06T16:55:19.979Z
---
Pure-source probes at c218e90: unionCommentArrays retains two entries for provider-only {id:P} and dual {local_id:L,id:P}. Same primary ID with bodies A/B retains first input; reversed order retains B; mergeIssues reports zero conflicts because comments are removed from namespace conflict comparison. Full-body versus capped stub can also compete. Define canonical alias enrichment and repeated immutable content versus conflicting prose; preserve recoverable conflicts and test merge order, pre/post push, provider-only echoes, full/stub entries, and independently recorded aliases. Research: docs/project/research/current/research-2026-09-06-bead-agent-coordination.md.
