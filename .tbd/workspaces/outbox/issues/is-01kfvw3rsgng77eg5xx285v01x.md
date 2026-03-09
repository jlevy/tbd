---
close_reason: Implemented --title option in update.ts
closed_at: 2026-01-26T00:56:05.690Z
created_at: 2026-01-26T00:43:57.615Z
dependencies: []
id: is-01kfvw3rsgng77eg5xx285v01x
kind: feature
labels: []
priority: 2
status: closed
title: "Feature: add --title option to tbd update command"
type: is
updated_at: 2026-03-09T16:12:32.921Z
version: 8
---
Add --title option to tbd update command for direct title updates without using --from-file.

Implementation:
1. Add --title option to UpdateOptions interface in update.ts
2. Add commander option: .option('--title <text>', 'Set title')
3. Add title parsing in parseUpdates()
4. Apply title update in run() method: if (updates.title !== undefined) issue.title = updates.title

Design doc updated: packages/tbd/docs/tbd-design.md now includes --title option.
