---
type: is
id: is-01kf5zyg8m18yaaz34scejk7je
title: "Bug: Ensure --help works on all subcommands, not just top-level help"
kind: bug
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T07:13:40.802Z
updated_at: 2026-03-09T16:12:29.794Z
closed_at: 2026-01-17T01:13:37.238Z
close_reason: cli-help-all.tryscript.md created with 21 tests verifying --help on all commands
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.294Z
    original_id: tbd-1822
---
Verify that --help flag works consistently on all subcommands (e.g., 'tbd list --help', 'tbd create --help', 'tbd sync --help'). Should not rely on a separate top-level 'help' command - standard CLI pattern is --help on each command. Commander.js should handle this automatically but verify all commands have proper help text.
