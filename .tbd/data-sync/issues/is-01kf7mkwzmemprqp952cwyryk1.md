---
type: is
id: is-01kf7mkwzmemprqp952cwyryk1
title: Create priority utilities
kind: task
status: closed
priority: 2
version: 12
labels: []
dependencies:
  - type: blocks
    target: is-01kf7mmaqg5nsqjkh5phewrt5h
  - type: blocks
    target: is-01kf7mmbmgck29wdg2ftdrsw9p
created_at: 2026-01-18T04:08:08.948Z
updated_at: 2026-03-09T16:12:31.562Z
closed_at: 2026-01-18T04:32:00.551Z
close_reason: Created lib/priority.ts with formatPriority(), parsePriority(), getPriorityColor() and 23 unit tests
---
Create lib/priority.ts with:
- formatPriority() utility for P0/P1/P2 display format
- parsePriority() utility accepting 'P1' or '1' input
- getPriorityColor() utility (P0=red, P1=yellow, P2-P4=default)
- Unit tests for priority utilities

Reference: plan spec section 2.3 (Priority Colors)
