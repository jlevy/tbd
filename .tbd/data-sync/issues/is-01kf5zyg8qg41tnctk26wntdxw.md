---
type: is
id: is-01kf5zyg8qg41tnctk26wntdxw
title: Add marked-terminal support for colorized Markdown help
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T12:27:23.818Z
updated_at: 2026-03-09T16:12:30.882Z
closed_at: 2026-01-17T12:40:21.363Z
close_reason: Implemented help width (88 chars max) and marked-terminal for colorized Markdown in docs/readme commands
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.124Z
    original_id: tbd-1936
---
Add marked + marked-terminal dependencies. Create renderMarkdown() utility in output.ts that: (1) Uses marked-terminal for colorized output when TTY, (2) Falls back to plain text when piped, (3) Respects --color option, (4) Caps width at 88 chars. This enables colorized Markdown in help text and docs commands.
