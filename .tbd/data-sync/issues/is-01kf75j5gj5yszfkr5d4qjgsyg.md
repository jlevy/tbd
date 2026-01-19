---
close_reason: Completed - issue tally counts are now only in 'tbd stats', not in 'tbd status'
closed_at: 2026-01-19T08:24:22.983Z
created_at: 2026-01-17T23:45:03.504Z
dependencies: []
id: is-01kf75j5gj5yszfkr5d4qjgsyg
kind: task
labels: []
priority: 2
status: closed
title: Move issue tally counts from tbd status to tbd stats
type: is
updated_at: 2026-01-19T08:24:22.983Z
version: 3
---
Currently `tbd status` shows issue counts (Ready, In progress, Open, Total). These should be moved to `tbd stats` so that:
- `tbd stats` is focused on issue statistics and metrics
- `tbd status` is focused on integration, configuration, and setup status

This makes the commands more focused and easier to understand.
