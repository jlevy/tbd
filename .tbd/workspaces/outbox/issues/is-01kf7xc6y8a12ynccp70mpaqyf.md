---
close_reason: null
closed_at: 2026-01-18T06:44:53.212Z
created_at: 2026-01-18T06:41:14.184Z
dependencies:
  - target: is-01kf7xcdp1tbqd2dmhc9kmbea1
    type: blocks
  - target: is-01kf7xce1xbw9cfj33xgwvev8y
    type: blocks
  - target: is-01kf7xcedmh3cx6n111y7msped
    type: blocks
id: is-01kf7xc6y8a12ynccp70mpaqyf
kind: feature
labels: []
priority: 1
status: closed
title: Implement tbd setup auto to detect and configure coding agents
type: is
updated_at: 2026-03-09T16:12:31.828Z
version: 11
---
Auto-detect available coding agents (Claude Code, Cursor, Codex) and set them up automatically. Detection strategies:
- Claude Code: ~/.claude/ exists or CLAUDE_* env vars present
- Cursor: .cursor/ directory exists
- Codex: AGENTS.md exists or CODEX_* env vars present

Output should log what was set up and what was skipped.
