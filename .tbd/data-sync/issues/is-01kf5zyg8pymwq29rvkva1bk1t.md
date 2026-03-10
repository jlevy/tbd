---
type: is
id: is-01kf5zyg8pymwq29rvkva1bk1t
title: Add "Why TBD?" motivation section
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T10:41:21.591Z
updated_at: 2026-03-09T16:12:30.690Z
closed_at: 2026-01-17T10:56:04.137Z
close_reason: Implemented documentation improvements
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.960Z
    original_id: tbd-1912
---
Add a brief motivation section near the top:

## Why TBD?

- **Git-native**: No external services, no databases—just files in git
- **AI-agent friendly**: JSON output, non-interactive mode, simple commands
- **File-per-issue**: No merge conflicts from parallel creation (unlike JSONL)
- **No daemon**: Works in restricted environments (CI, cloud sandboxes)
- **Beads compatible**: Drop-in replacement, preserves issue IDs
