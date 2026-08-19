---
type: is
id: is-01m0c70vr5xc7jx3hb8q0pq357
title: "PR #245 review R2: slot function undefined for legacy blocked/deferred statuses"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m0c70tzc5skz4tp79sfmmyrg
created_at: 2026-08-19T05:13:36.772Z
updated_at: 2026-08-19T05:15:10.868Z
closed_at: 2026-08-19T05:15:10.867Z
close_reason: "Fixed in 89c97de9: legacy rule blocked→blocked, deferred→backlog after the ladder; Approach block annotated; Phase 3 test pins it"
---
state spec, Approach block + sync algorithm. Enum is five-valued (mapping.ts:50-55); ladder assigns legacy statuses no slot in state_map repos. Fix: legacy rule blocked→blocked, deferred→backlog; annotate Approach block.
