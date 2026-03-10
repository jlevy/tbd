---
type: is
id: is-01kf7txhm7qymw9r340wq3sf1f
title: Add formatHeading utility to output module
kind: task
status: closed
priority: 2
version: 12
labels: []
dependencies:
  - type: blocks
    target: is-01kf7txfqsysqjhq6bnzc88nbk
  - type: blocks
    target: is-01kf7txg70z7rb97amyvh72msj
  - type: blocks
    target: is-01kf7txgnsdw96n588gr4yt6z2
  - type: blocks
    target: is-01kf7txh4qw9qxyg2ycc04gk0f
created_at: 2026-01-18T05:58:16.454Z
updated_at: 2026-03-09T16:12:31.777Z
closed_at: 2026-01-18T06:18:22.432Z
close_reason: Added formatHeading() function to output.ts with tests
---
Implement formatHeading(text) function in output.ts that returns colors.bold(text.toUpperCase()) for consistent section heading formatting.
