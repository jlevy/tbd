---
close_reason: Implemented documentation improvements
closed_at: 2026-01-17T10:56:04.137Z
created_at: 2026-01-17T10:41:21.591Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.960Z
    original_id: tbd-1912
id: is-01kf5zyg8pymwq29rvkva1bk1t
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add "Why TBD?" motivation section
type: is
updated_at: 2026-03-09T02:47:21.820Z
version: 5
---
Add a brief motivation section near the top:

## Why TBD?

- **Git-native**: No external services, no databases—just files in git
- **AI-agent friendly**: JSON output, non-interactive mode, simple commands
- **File-per-issue**: No merge conflicts from parallel creation (unlike JSONL)
- **No daemon**: Works in restricted environments (CI, cloud sandboxes)
- **Beads compatible**: Drop-in replacement, preserves issue IDs
