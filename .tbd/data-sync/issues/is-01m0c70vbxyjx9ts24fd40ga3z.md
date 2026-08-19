---
type: is
id: is-01m0c70vbxyjx9ts24fd40ga3z
title: "PR #245 review R1: slot ladder drops hold:blocked on open beads"
kind: bug
status: closed
priority: 2
version: 4
assignee: null
delegate: claude-code@spud10
labels: []
dependencies: []
parent_id: is-01m0c70tzc5skz4tp79sfmmyrg
created_at: 2026-08-19T05:13:36.380Z
updated_at: 2026-08-19T05:56:31.465Z
closed_at: 2026-08-19T05:15:10.535Z
close_reason: "Fixed in 89c97de9: ladder step 5 covers any hold; hold excludes ready (contract on tbd ready, Phase 2 test); backlog row reads 'not ready or held'"
---
state spec, precedence ladder steps 5-7 + open-end table. open+hold:blocked falls through to todo when deps are met. Fix: step 5 covers any hold; hold excludes ready; Phase 2 checklist item; backlog row 'not ready or held'.
