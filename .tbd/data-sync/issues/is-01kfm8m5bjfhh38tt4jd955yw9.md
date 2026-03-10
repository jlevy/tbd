---
type: is
id: is-01kfm8m5bjfhh38tt4jd955yw9
title: Create claude-header.md with Claude-specific YAML frontmatter
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
created_at: 2026-01-23T01:48:42.225Z
updated_at: 2026-03-09T16:12:32.208Z
closed_at: 2026-01-23T02:53:37.607Z
close_reason: Created docs/headers/claude.md with Claude YAML frontmatter (name, description, allowed-tools) and Installation section
---
Create docs/headers/claude.md containing only the YAML frontmatter for Claude SKILL.md:

```yaml
---
name: tbd
description: Lightweight, git-native issue tracking...
allowed-tools: Bash(tbd:*), Read, Write
---
```

This file will be concatenated with skill.md to produce SKILL.md during build.
