---
type: is
id: is-01kf5zyg8mesd2gfgmxbhnxc8p
title: "Bug: Inconsistent color usage in help text across commands"
kind: bug
status: closed
priority: 3
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T07:13:41.203Z
updated_at: 2026-03-09T16:12:29.902Z
closed_at: 2026-01-17T10:23:27.757Z
close_reason: "Fixed: Applied colored help configuration to all commands recursively. Updated research doc to correct Commander.js .addCommand() behavior."
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.300Z
    original_id: tbd-1823
---
Ensure consistent colored output across all help text: (1) Top-level 'tbd --help', (2) Subcommand help 'tbd list --help', (3) Error messages. Colors should respect --color flag (auto/always/never) and NO_COLOR env var. Check that Commander.js v14 style functions are applied uniformly.
