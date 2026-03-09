---
close_reason: Updated tbd setup to run shortcuts refresh - creates docs directories and generates shortcut cache before configuring integrations
closed_at: 2026-01-23T04:40:30.387Z
created_at: 2026-01-23T03:03:05.050Z
dependencies:
  - target: is-01kfmfcxe81nfhaz1aqjg311jq
    type: blocks
id: is-01kfmcwbjvfyawp149ayvzbmwx
kind: task
labels: []
parent_id: is-01kfhvzn1vbsam9xckr0njfbqg
priority: 1
status: closed
title: Update tbd setup to run shortcuts refresh after copying docs
type: is
updated_at: 2026-03-09T16:12:32.356Z
version: 10
---
Update unified tbd setup command to run tbd shortcut --refresh --quiet before installing skill files. Embed shortcut directory in all targets: .claude/skills/tbd.md, .cursor/rules/tbd.mdc, AGENTS.md, docs/SKILL.md.
