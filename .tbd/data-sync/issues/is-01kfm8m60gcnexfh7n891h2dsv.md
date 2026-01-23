---
close_reason: Updated copy-docs.mjs to compose SKILL.md and CURSOR.mdc from headers + skill.md using composeFile() function
closed_at: 2026-01-23T02:53:45.422Z
created_at: 2026-01-23T01:48:42.895Z
dependencies:
  - target: is-01kfm8m6aeevnmdsarqqywwzrk
    type: blocks
  - target: is-01kf7j53z1gahrqswh8x4v4b6t
    type: blocks
id: is-01kfm8m60gcnexfh7n891h2dsv
kind: task
labels: []
priority: 2
status: closed
title: Update build to compose SKILL.md and CURSOR.mdc from parts
type: is
updated_at: 2026-01-23T02:53:45.423Z
version: 6
---
Update copy-docs.mjs to compose SKILL.md and CURSOR.mdc from parts:

1. Read headers/claude.md + skill.md → write SKILL.md
2. Read headers/cursor.md + skill.md → write CURSOR.mdc
3. Keep skill-brief.md as-is (already clean markdown)

Remove SKILL.md and CURSOR.mdc from DOCS_FILES since they're now generated.
