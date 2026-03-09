---
close_reason: Implemented --from-file processing in update.ts
closed_at: 2026-01-26T00:56:05.578Z
created_at: 2026-01-26T00:43:57.365Z
dependencies: []
id: is-01kfvw3rhphpm01kabdmvp6cah
kind: bug
labels: []
priority: 2
status: closed
title: "Bug: update command --from-file option not implemented"
type: is
updated_at: 2026-03-09T16:12:32.916Z
version: 8
---
The --from-file option is declared in update.ts line 227 but parseUpdates() method never processes options.fromFile. Need to:
1. Read the YAML+Markdown file using the existing file format
2. Parse it to extract all updateable fields (title, status, type, priority, assignee, description, notes, due_date, deferred_until, parent_id, labels)
3. Apply updates using the existing update logic
4. See tbd-design.md §4.4 Update for --from-file behavior specification
