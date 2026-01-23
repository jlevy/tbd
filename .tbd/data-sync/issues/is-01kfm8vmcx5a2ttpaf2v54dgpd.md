---
close_reason: Created docs/skill.md with shared skill content (session protocol, commands, workflows) - no frontmatter
closed_at: 2026-01-23T02:53:45.087Z
created_at: 2026-01-23T01:52:47.004Z
dependencies:
  - target: is-01kfm8m60gcnexfh7n891h2dsv
    type: blocks
  - target: is-01kf7j53z1gahrqswh8x4v4b6t
    type: blocks
id: is-01kfm8vmcx5a2ttpaf2v54dgpd
kind: task
labels: []
priority: 2
status: closed
title: Extract shared workflow content to skill.md
type: is
updated_at: 2026-01-23T02:53:45.088Z
version: 6
---
Create docs/skill.md with the main skill content (no frontmatter):

1. Extract the common content from SKILL.md (everything after the YAML frontmatter)
2. This becomes the single source of truth for all agent instructions
3. SKILL.md and CURSOR.mdc will be generated from headers + skill.md

Content includes: workflow rules, session closing protocol, essential commands, common workflows.
