---
type: is
id: is-01kfv1k095bw0msh1h9y33mz08
title: "[PR#25] Fix gitignore path for tbd skill file"
kind: task
status: closed
priority: 2
version: 7
labels:
  - bug
dependencies: []
created_at: 2026-01-25T17:00:25.237Z
updated_at: 2026-03-09T16:12:32.793Z
closed_at: 2026-01-25T17:01:21.021Z
close_reason: "Fixed: Updated .gitignore to use .claude/skills/tbd/ instead of .claude/skills/tbd.md"
---
The .gitignore has '.claude/skills/tbd.md' but the actual file is at '.claude/skills/tbd/SKILL.md'. Update gitignore to match actual path.
