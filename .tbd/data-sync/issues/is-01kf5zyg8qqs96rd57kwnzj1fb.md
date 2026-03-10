---
type: is
id: is-01kf5zyg8qqs96rd57kwnzj1fb
title: Set Commander help width to max 88 characters
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T12:27:23.450Z
updated_at: 2026-03-09T16:12:30.941Z
closed_at: 2026-01-17T12:40:21.363Z
close_reason: Implemented help width (88 chars max) and marked-terminal for colorized Markdown in docs/readme commands
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.117Z
    original_id: tbd-1935
---
Add helpWidth to createColoredHelpConfig() in output.ts. Use Math.min(88, process.stdout.columns || 80) to cap help text at 88 characters while respecting narrower terminals.
