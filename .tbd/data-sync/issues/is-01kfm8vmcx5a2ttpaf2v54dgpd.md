---
type: is
id: is-01kfm8vmcx5a2ttpaf2v54dgpd
title: Extract shared workflow content to skill.md
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
created_at: 2026-01-23T01:52:47.004Z
updated_at: 2026-03-09T16:12:32.269Z
closed_at: 2026-01-23T02:53:45.087Z
close_reason: Created docs/skill.md with shared skill content (session protocol, commands, workflows) - no frontmatter
---
Create docs/skill.md with the main skill content (no frontmatter):

1. Extract the common content from SKILL.md (everything after the YAML frontmatter)
2. This becomes the single source of truth for all agent instructions
3. SKILL.md and CURSOR.mdc will be generated from headers + skill.md

Content includes: workflow rules, session closing protocol, essential commands, common workflows.
