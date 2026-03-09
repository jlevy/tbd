---
created_at: 2026-01-22T03:30:55.957Z
dependencies:
  - target: is-01kfhvzn1vbsam9xckr0njfbqg
    type: blocks
id: is-01kfhw2mapxdm0g9kzk3da0egf
kind: task
labels: []
parent_id: is-01kfhvzn1vbsam9xckr0njfbqg
priority: 2
status: open
title: Add golden tests for shortcut output formats
type: is
updated_at: 2026-03-09T02:47:23.087Z
version: 8
---
Create tests/cli/shortcut.golden.test.ts with golden tests capturing CLI output for: tbd shortcut --list, tbd shortcut <name>, tbd shortcut --list --all (with shadowed entries), and JSON output mode.
