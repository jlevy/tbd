---
type: is
id: is-01kfhw10femx3y9vr4srjx11c2
title: Implement shortcut query matching
kind: task
status: closed
priority: 1
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kfhw2g8t8jq841n2q51msy77
  - type: blocks
    target: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-22T03:30:02.861Z
updated_at: 2026-03-09T16:12:32.051Z
closed_at: 2026-01-23T02:43:45.355Z
close_reason: "Implemented: shortcut.ts has handleQuery() that tries exact match first via cache.get(), then fuzzy via cache.search()"
---
Implement query handling in shortcut command: try exact match with get(), then fuzzy with search(). Use SCORE_MIN_THRESHOLD constant for low-confidence detection. Show suggestions if score < threshold, otherwise output matched document content. Support --json output mode.
