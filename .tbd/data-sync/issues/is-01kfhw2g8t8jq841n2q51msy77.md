---
type: is
id: is-01kfhw2g8t8jq841n2q51msy77
title: Add integration tests for shortcut command
kind: task
status: open
priority: 2
version: 9
labels: []
dependencies:
  - type: blocks
    target: is-01kfhvzn1vbsam9xckr0njfbqg
parent_id: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-22T03:30:51.801Z
updated_at: 2026-03-09T16:12:32.114Z
---
Create tests/cli/shortcut.integration.test.ts with integration tests: full command flow from CLI to file system, config loading with custom doc paths, installation flow (copying shortcuts during setup).
