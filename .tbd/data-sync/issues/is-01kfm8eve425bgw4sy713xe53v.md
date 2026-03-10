---
type: is
id: is-01kfm8eve425bgw4sy713xe53v
title: Verify skill command (internal) docs consistency
kind: task
status: closed
priority: 3
version: 8
labels:
  - docs-review
  - internal
dependencies:
  - type: blocks
    target: is-01kf7j53z1gahrqswh8x4v4b6t
created_at: 2026-01-23T01:45:48.227Z
updated_at: 2026-03-09T16:12:32.191Z
closed_at: 2026-01-23T02:56:33.961Z
close_reason: "Verified: skill command outputs correctly composed SKILL.md from headers/claude.md + skill.md"
---
The skill command is a new internal command not exposed in main CLI help. Verify:
- Internal documentation/comments are accurate
- If it should be documented publicly in tbd-docs.md
- Options work as documented (--brief)
- Integration with bundled docs system (SKILL.md, skill-brief.md)
