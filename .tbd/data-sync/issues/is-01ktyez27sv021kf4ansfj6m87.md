---
type: is
id: is-01ktyez27sv021kf4ansfj6m87
title: "DocMap: drop word_count from the core schema"
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyessevb2mdcafd12z7670n
created_at: 2026-06-12T17:44:35.321Z
updated_at: 2026-06-12T18:20:45.738Z
closed_at: 2026-06-12T18:20:45.738Z
close_reason: "Fixed in a3a5b37: word_count removed from core schema (extension fields carry size metrics); spec example updated in e8b5112."
---
PR #169 review sec 4. The only unit-opinionated presentation field, and tbd (the only producer) does not emit it - it renders bytes + approx tokens. Remove from core; size/length metrics are extension fields. Update the spec docmap example.
