---
close_reason: Implemented help epilog with GitHub link in blue color that shows at the bottom of all help commands
closed_at: 2026-01-17T10:29:18.344Z
created_at: 2026-01-17T10:26:14.659Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.911Z
    original_id: tbd-1906
id: is-01kf5zyg8ppysgvwz61prg0wee
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add help epilog with GitHub link to all CLI help commands
type: is
updated_at: 2026-03-09T02:47:21.730Z
version: 5
---
Add a colored (dark blue) epilog at the bottom of all help/usage commands that displays: 'For more on tbd, see: https://github.com/jlevy/tbd'. Implementation: 1) Add createHelpEpilog() function in output.ts, 2) Update applyColoredHelpToAllCommands() to add the epilog to main program and all subcommands using addHelpText().
