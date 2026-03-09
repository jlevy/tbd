---
close_reason: cli-help-all.tryscript.md created with 21 tests verifying --help on all commands
closed_at: 2026-01-17T01:13:37.238Z
created_at: 2026-01-16T07:13:40.802Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.294Z
    original_id: tbd-1822
id: is-01kf5zyg8m18yaaz34scejk7je
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: "Bug: Ensure --help works on all subcommands, not just top-level help"
type: is
updated_at: 2026-03-09T02:47:20.971Z
version: 5
---
Verify that --help flag works consistently on all subcommands (e.g., 'tbd list --help', 'tbd create --help', 'tbd sync --help'). Should not rely on a separate top-level 'help' command - standard CLI pattern is --help on each command. Commander.js should handle this automatically but verify all commands have proper help text.
