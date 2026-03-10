---
type: is
id: is-01kfhw2mapxdm0g9kzk3da0egf
title: Add golden tests for shortcut output formats
kind: task
status: open
priority: 2
version: 9
labels: []
dependencies:
  - type: blocks
    target: is-01kfhvzn1vbsam9xckr0njfbqg
parent_id: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-22T03:30:55.957Z
updated_at: 2026-03-09T16:12:32.120Z
---
Create tests/cli/shortcut.golden.test.ts with golden tests capturing CLI output for: tbd shortcut --list, tbd shortcut <name>, tbd shortcut --list --all (with shadowed entries), and JSON output mode.
