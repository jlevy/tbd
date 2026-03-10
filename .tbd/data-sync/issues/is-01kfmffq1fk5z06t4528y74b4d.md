---
type: is
id: is-01kfmffq1fk5z06t4528y74b4d
title: Replace CURSOR.mdc with cursor-header.md (YAML frontmatter only)
kind: task
status: closed
priority: 1
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kfmffq9gccjakj8nc4rq3q7x
parent_id: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-23T03:48:36.526Z
updated_at: 2026-03-09T16:12:32.419Z
closed_at: 2026-01-23T04:21:44.513Z
close_reason: Created cursor-header.md and claude-header.md in src/docs/install/, build passes
---
Create docs/install/cursor-header.md containing only the Cursor YAML frontmatter. Delete packages/tbd/src/docs/CURSOR.mdc. When installing .cursor/rules/tbd.mdc, setup will combine: cursor-header.md + skill.md + shortcut directory.
