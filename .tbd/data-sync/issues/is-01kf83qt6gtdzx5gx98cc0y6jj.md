---
type: is
id: is-01kf83qt6gtdzx5gx98cc0y6jj
title: Generate commit body with long-format issue summaries (title, description, close_reason)
kind: task
status: open
priority: 2
version: 9
labels: []
dependencies:
  - type: blocks
    target: is-01kf83qzj2bzffyeqdrryhn64m
parent_id: is-01kf83qm50827p60a7cg7jkqpd
created_at: 2026-01-18T08:32:25.807Z
updated_at: 2026-03-09T16:12:31.938Z
---
Generate commit body in long format similar to 'tbd list --long':
- For each modified issue, show one-line summary
- Include: short ID, title (truncated), description (truncated)
- For closed issues, include close_reason if present
- Truncate title/description similar to issueFormat.ts formatIssueLong()
- Group by action type (new/updated/deleted) if desired

Use formatIssueLong from issueFormat.ts as reference.
