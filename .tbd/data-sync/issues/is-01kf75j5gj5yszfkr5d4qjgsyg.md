---
type: is
id: is-01kf75j5gj5yszfkr5d4qjgsyg
title: Move issue tally counts from tbd status to tbd stats
kind: task
status: closed
priority: 2
version: 8
labels: []
dependencies: []
created_at: 2026-01-17T23:45:03.504Z
updated_at: 2026-03-09T16:12:31.196Z
closed_at: 2026-01-19T08:24:22.983Z
close_reason: Completed - issue tally counts are now only in 'tbd stats', not in 'tbd status'
---
Currently `tbd status` shows issue counts (Ready, In progress, Open, Total). These should be moved to `tbd stats` so that:
- `tbd stats` is focused on issue statistics and metrics
- `tbd status` is focused on integration, configuration, and setup status

This makes the commands more focused and easier to understand.
