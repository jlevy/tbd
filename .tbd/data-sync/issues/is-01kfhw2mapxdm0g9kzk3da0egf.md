---
type: is
id: is-01kfhw2mapxdm0g9kzk3da0egf
title: Add golden tests for shortcut output formats
kind: task
status: closed
priority: 2
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kfhvzn1vbsam9xckr0njfbqg
parent_id: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-22T03:30:55.957Z
updated_at: 2026-08-15T05:34:04.588Z
closed_at: 2026-08-15T05:34:04.588Z
close_reason: Delivered or superseded by the current DocCache, shortcut, refresh, skill-directory, generated-file drift, and integration test coverage.
---
Create tests/cli/shortcut.golden.test.ts with golden tests capturing CLI output for: tbd shortcut --list, tbd shortcut <name>, tbd shortcut --list --all (with shadowed entries), and JSON output mode.
