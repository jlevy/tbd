---
type: is
id: is-01kzwxnc2yv7vhm5x9qs144401
title: "Web: support an initialized repository with zero beads"
kind: task
status: closed
priority: 1
version: 3
labels:
  - review
  - web
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:41:26.615Z
updated_at: 2026-08-13T07:16:17.472Z
closed_at: 2026-08-13T07:16:17.471Z
close_reason: Fixed in 5f32e14f with focused TDD and full release-gate validation
---
File/function scope: packages/tbd/tests/cli-web.test.ts fixture setup and spawned-process acceptance; packages/tbd/src/cli/web/{server,board}.ts only if the empty snapshot path fails. Prove tbd web starts, /api/board returns rows: [] with zero counts, the page renders its empty state, and shutdown remains clean.

## Notes

TDD complete: packages/tbd/tests/cli-web.test.ts now starts the built CLI against an initialized zero-bead repository, verifies the zero-count /api/board snapshot and empty-state page, and confirms clean shutdown. No production server change was needed because the existing board pipeline already models an empty graph correctly.
