---
close_reason: Closed
closed_at: 2026-01-17T11:50:25.206Z
created_at: 2026-01-17T11:03:31.210Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.019Z
    original_id: tbd-1922
id: is-01kf5zyg8p7885k4j2s9g13tff
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Remove -V shorthand for --version option
type: is
updated_at: 2026-03-09T16:12:30.510Z
version: 6
---
Remove the -V one-letter option alias for --version. Keep only --version.

Files to update:
- packages/tbd-cli/src/cli/cli.ts (remove -V from option definition)
- packages/tbd-cli/tests/cli-setup.tryscript.md (update test to use --version)
