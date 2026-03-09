---
close_reason: Implemented help width (88 chars max) and marked-terminal for colorized Markdown in docs/readme commands
closed_at: 2026-01-17T12:40:21.363Z
created_at: 2026-01-17T12:27:23.818Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.124Z
    original_id: tbd-1936
id: is-01kf5zyg8qg41tnctk26wntdxw
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add marked-terminal support for colorized Markdown help
type: is
updated_at: 2026-03-09T02:47:22.000Z
version: 5
---
Add marked + marked-terminal dependencies. Create renderMarkdown() utility in output.ts that: (1) Uses marked-terminal for colorized output when TTY, (2) Falls back to plain text when piped, (3) Respects --color option, (4) Caps width at 88 chars. This enables colorized Markdown in help text and docs commands.
