---
type: is
id: is-01kf5zyg8p7885k4j2s9g13tff
title: Remove -V shorthand for --version option
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T11:03:31.210Z
updated_at: 2026-03-09T16:12:30.510Z
closed_at: 2026-01-17T11:50:25.206Z
close_reason: Closed
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.019Z
    original_id: tbd-1922
---
Remove the -V one-letter option alias for --version. Keep only --version.

Files to update:
- packages/tbd-cli/src/cli/cli.ts (remove -V from option definition)
- packages/tbd-cli/tests/cli-setup.tryscript.md (update test to use --version)
