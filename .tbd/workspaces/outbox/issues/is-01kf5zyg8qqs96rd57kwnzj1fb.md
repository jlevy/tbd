---
close_reason: Implemented help width (88 chars max) and marked-terminal for colorized Markdown in docs/readme commands
closed_at: 2026-01-17T12:40:21.363Z
created_at: 2026-01-17T12:27:23.450Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.117Z
    original_id: tbd-1935
id: is-01kf5zyg8qqs96rd57kwnzj1fb
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Set Commander help width to max 88 characters
type: is
updated_at: 2026-03-09T02:47:22.056Z
version: 5
---
Add helpWidth to createColoredHelpConfig() in output.ts. Use Math.min(88, process.stdout.columns || 80) to cap help text at 88 characters while respecting narrower terminals.
