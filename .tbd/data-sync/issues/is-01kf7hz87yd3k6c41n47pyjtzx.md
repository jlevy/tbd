---
type: is
id: is-01kf7hz87yd3k6c41n47pyjtzx
title: Include YAML frontmatter in source SKILL.md file
kind: task
status: closed
priority: 2
version: 9
labels: []
dependencies: []
created_at: 2026-01-18T03:21:55.197Z
updated_at: 2026-03-09T16:12:31.464Z
closed_at: 2026-01-18T06:03:30.230Z
close_reason: "Implemented: YAML frontmatter now in source docs/SKILL.md"
---
Move the YAML frontmatter from setup.ts into the source docs/SKILL.md file.

Current state:
- docs/SKILL.md contains just the markdown content
- setup.ts has SKILL_FRONTMATTER constant that gets prepended
- The installed .claude/skills/tbd/SKILL.md has frontmatter

Target state:
- docs/SKILL.md includes the YAML frontmatter at the top:
  ```yaml
  ---
  name: tbd
  description: Git-native issue tracking for AI agents...
  allowed-tools: Bash(tbd:*), Read, Write
  ---
  ```
- setup.ts simply copies the file as-is (no prepending)
- `tbd prime` outputs the full content including YAML (this is fine)

Benefits:
- Single source of truth for skill content
- Easier to edit and maintain
- Standard skill file format in the repo
- Removes code duplication in setup.ts
