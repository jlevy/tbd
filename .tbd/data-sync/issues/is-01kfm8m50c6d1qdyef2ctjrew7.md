---
close_reason: Created docs/headers/cursor.md with Cursor YAML frontmatter (description, alwaysApply)
closed_at: 2026-01-23T02:53:37.861Z
created_at: 2026-01-23T01:48:41.865Z
dependencies:
  - target: is-01kfm8m60gcnexfh7n891h2dsv
    type: blocks
  - target: is-01kf7j53z1gahrqswh8x4v4b6t
    type: blocks
id: is-01kfm8m50c6d1qdyef2ctjrew7
kind: task
labels: []
priority: 2
status: closed
title: Create cursor-header.md with Cursor-specific YAML frontmatter
type: is
updated_at: 2026-01-23T02:53:37.862Z
version: 6
---
Create docs/headers/cursor.md containing only the YAML frontmatter for Cursor rules:

```yaml
---
description: tbd workflow rules for git-native issue tracking...
alwaysApply: false
---
```

This file will be concatenated with skill.md to produce CURSOR.mdc during build.
