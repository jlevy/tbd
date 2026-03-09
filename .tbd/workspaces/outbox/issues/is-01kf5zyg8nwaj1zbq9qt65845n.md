---
close_reason: Implemented in commit 11fbe51
closed_at: 2026-01-17T01:34:03.040Z
created_at: 2026-01-16T07:14:45.069Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.388Z
    original_id: tbd-1835
id: is-01kf5zyg8nwaj1zbq9qt65845n
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Write docs/tbd-docs.md documentation file for bundling with CLI
type: is
updated_at: 2026-03-09T16:12:30.352Z
version: 6
---
Create docs/tbd-docs.md with comprehensive CLI documentation. This file will be copied to packages/tbd-cli/src/docs/ during build and bundled with the CLI for offline access via 'tbd docs'. Follow the pattern used in markform/tryscript where docs are maintained in docs/ directory and copied to code during build. Content should include: quick reference, all commands with examples, common workflows, ID system explanation, sync/import guides.
