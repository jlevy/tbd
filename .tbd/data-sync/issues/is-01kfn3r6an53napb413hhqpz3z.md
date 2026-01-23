---
close_reason: Created tbd guidelines command in guidelines.ts
closed_at: 2026-01-23T09:55:10.223Z
created_at: 2026-01-23T09:42:45.844Z
dependencies: []
id: is-01kfn3r6an53napb413hhqpz3z
kind: task
labels: []
parent_id: is-01kfn3qm96pv26s4bnntywy0ht
priority: 2
status: closed
title: Create tbd guidelines command
type: is
updated_at: 2026-01-23T09:55:10.224Z
version: 2
---
Create new guidelines.ts command file using the shared DocCommandHandler. Commands: tbd guidelines [query] - show a guideline by name or fuzzy search, tbd guidelines --list - list all available guidelines. Uses DEFAULT_GUIDELINES_PATHS for document discovery.
