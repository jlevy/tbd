---
type: is
id: is-01kfm8ev400c9cffbgc2njgj18
title: Verify shortcut command (internal) docs consistency
kind: task
status: closed
priority: 3
version: 8
labels:
  - docs-review
  - internal
dependencies:
  - type: blocks
    target: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-23T01:45:47.903Z
updated_at: 2026-03-09T16:12:32.186Z
closed_at: 2026-01-26T17:24:24.288Z
close_reason: Shortcut command being rewritten. Old docs no longer relevant.
---
The shortcut command is a new internal command not exposed in main CLI help. Verify:
- Internal documentation/comments are accurate
- If it should be documented publicly in tbd-docs.md
- Options work as documented (--list, --all)
- Integration with DocCache and shortcuts system
