---
type: is
id: is-01kfmcwbjvfyawp149ayvzbmwx
title: Update tbd setup to run shortcuts refresh after copying docs
kind: task
status: closed
priority: 1
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kfmfcxe81nfhaz1aqjg311jq
parent_id: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-23T03:03:05.050Z
updated_at: 2026-03-09T16:12:32.356Z
closed_at: 2026-01-23T04:40:30.387Z
close_reason: Updated tbd setup to run shortcuts refresh - creates docs directories and generates shortcut cache before configuring integrations
---
Update unified tbd setup command to run tbd shortcut --refresh --quiet before installing skill files. Embed shortcut directory in all targets: .claude/skills/tbd.md, .cursor/rules/tbd.mdc, AGENTS.md, docs/SKILL.md.
