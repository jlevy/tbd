---
type: is
id: is-01kfhw14rzpqp59p3rkem2720t
title: Implement shortcut --list and --all flags
kind: task
status: closed
priority: 1
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kfhw2g8t8jq841n2q51msy77
  - type: blocks
    target: is-01kfhw2mapxdm0g9kzk3da0egf
  - type: blocks
    target: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-22T03:30:07.262Z
updated_at: 2026-03-09T16:12:32.056Z
closed_at: 2026-01-23T02:43:45.596Z
close_reason: "Implemented: shortcut command has --list and --all options with handleList() method that shows shadowed docs"
---
Implement --list flag showing active shortcuts with source path in muted text. Implement --all flag (with --list) to include shadowed shortcuts marked as [shadowed]. Add --json flag for structured output.
