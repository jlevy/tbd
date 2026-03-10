---
type: is
id: is-01kf5zyg8ppysgvwz61prg0wee
title: Add help epilog with GitHub link to all CLI help commands
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T10:26:14.659Z
updated_at: 2026-03-09T16:12:30.599Z
closed_at: 2026-01-17T10:29:18.344Z
close_reason: Implemented help epilog with GitHub link in blue color that shows at the bottom of all help commands
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.911Z
    original_id: tbd-1906
---
Add a colored (dark blue) epilog at the bottom of all help/usage commands that displays: 'For more on tbd, see: https://github.com/jlevy/tbd'. Implementation: 1) Add createHelpEpilog() function in output.ts, 2) Update applyColoredHelpToAllCommands() to add the epilog to main program and all subcommands using addHelpText().
