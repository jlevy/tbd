---
type: is
id: is-01kfmffq9gccjakj8nc4rq3q7x
title: Update setup to combine header + skill.md + shortcut directory when installing
kind: task
status: closed
priority: 1
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kfmcwbjvfyawp149ayvzbmwx
parent_id: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-23T03:48:36.784Z
updated_at: 2026-03-09T16:12:32.425Z
closed_at: 2026-01-23T04:46:38.266Z
close_reason: Updated setup handlers to append shortcut directory when installing skill files. Added getShortcutDirectory() helper and integrated with installClaudeSetup, installCursorRules, and getCodexTbdSection.
---
Update setup command to assemble installed files by combining: tool-specific header (from docs/install/) + skill.md content + shortcut directory. Applies to .claude/skills/tbd/SKILL.md, .cursor/rules/tbd.mdc, docs/SKILL.md, AGENTS.md.
