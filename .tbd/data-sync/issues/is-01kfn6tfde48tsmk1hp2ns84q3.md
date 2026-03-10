---
type: is
id: is-01kfn6tfde48tsmk1hp2ns84q3
title: "setup.ts: missing --from-beads validation"
kind: bug
status: closed
priority: 2
version: 7
labels:
  - high-priority
dependencies: []
created_at: 2026-01-23T10:36:26.413Z
updated_at: 2026-03-09T16:12:32.525Z
closed_at: 2026-01-23T10:40:10.891Z
close_reason: "Fixed: added validation that --from-beads requires .beads/ directory"
---
Should error when --from-beads flag used but no .beads/ directory exists.
