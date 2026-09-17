---
type: is
id: is-01m2pttfc7cp9qz4ynvaxm16vx
title: "P2: Resolve the CLAUDE_CODE_SUBAGENT_MODEL pin in .claude/settings.json"
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T04:43:26.982Z
updated_at: 2026-09-17T04:43:26.982Z
---
This repo's committed .claude/settings.json pins CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-6, so unnamed Claude Code sub-agent spawns run Opus 4.6. Apply the decision from Open Question 14 (remove the pin, or update it).
