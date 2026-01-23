---
close_reason: Created docs/headers/ directory with claude.md and cursor.md header files
closed_at: 2026-01-23T02:53:37.365Z
created_at: 2026-01-18T03:25:12.383Z
dependencies:
  - target: is-01kf7hx5ysfrbynw0cf54x6brb
    type: blocks
  - target: is-01kf7j53z1gahrqswh8x4v4b6t
    type: blocks
id: is-01kf7j58t0qxdh5j7rvpaetbd7
kind: task
labels: []
parent_id: is-01kf7j53z1gahrqswh8x4v4b6t
priority: 2
status: closed
title: Create unified agent-rules directory
type: is
updated_at: 2026-01-23T02:53:37.366Z
version: 8
---
Create docs/headers/ directory structure:

```
docs/
  headers/
    claude.md      # Claude YAML frontmatter
    cursor.md      # Cursor YAML frontmatter  
    codex.md       # Codex YAML frontmatter (if needed)
  skill.md         # Main skill content (shared)
  skill-brief.md   # Brief version (existing)
```

This replaces the previous 'agent-rules' concept with a simpler headers + content model.
