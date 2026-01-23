---
close_reason: Updated setup handlers to append shortcut directory when installing skill files. Added getShortcutDirectory() helper and integrated with installClaudeSetup, installCursorRules, and getCodexTbdSection.
closed_at: 2026-01-23T04:46:38.266Z
created_at: 2026-01-23T03:48:36.784Z
dependencies:
  - target: is-01kfmcwbjvfyawp149ayvzbmwx
    type: blocks
id: is-01kfmffq9gccjakj8nc4rq3q7x
kind: task
labels: []
parent_id: is-01kfhvzn1vbsam9xckr0njfbqg
priority: 1
status: closed
title: Update setup to combine header + skill.md + shortcut directory when installing
type: is
updated_at: 2026-01-23T04:46:38.267Z
version: 5
---
Update setup command to assemble installed files by combining: tool-specific header (from docs/install/) + skill.md content + shortcut directory. Applies to .claude/skills/tbd/SKILL.md, .cursor/rules/tbd.mdc, docs/SKILL.md, AGENTS.md.
