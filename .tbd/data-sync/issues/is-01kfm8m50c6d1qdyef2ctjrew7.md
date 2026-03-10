---
type: is
id: is-01kfm8m50c6d1qdyef2ctjrew7
title: Create cursor-header.md with Cursor-specific YAML frontmatter
kind: task
status: closed
priority: 2
version: 11
labels: []
dependencies:
  - type: blocks
    target: is-01kfm8m60gcnexfh7n891h2dsv
  - type: blocks
    target: is-01kf7j53z1gahrqswh8x4v4b6t
created_at: 2026-01-23T01:48:41.865Z
updated_at: 2026-03-09T16:12:32.202Z
closed_at: 2026-01-23T02:53:37.861Z
close_reason: Created docs/headers/cursor.md with Cursor YAML frontmatter (description, alwaysApply)
---
Create docs/headers/cursor.md containing only the YAML frontmatter for Cursor rules:

```yaml
---
description: tbd workflow rules for git-native issue tracking...
alwaysApply: false
---
```

This file will be concatenated with skill.md to produce CURSOR.mdc during build.
