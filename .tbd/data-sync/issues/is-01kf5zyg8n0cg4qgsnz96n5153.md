---
type: is
id: is-01kf5zyg8n0cg4qgsnz96n5153
title: Create cli-help-all.tryscript.md - verify --help on every subcommand
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T18:46:51.050Z
updated_at: 2026-03-09T16:12:30.099Z
closed_at: 2026-01-17T01:13:37.238Z
close_reason: cli-help-all.tryscript.md created with 21 tests verifying --help on all commands
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.462Z
    original_id: tbd-1845
---
New tryscript file that runs '<command> --help' for EVERY subcommand and verifies: (1) Help text shown, (2) Options documented, (3) Consistent formatting, (4) No errors.
