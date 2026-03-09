---
close_reason: Updated status.ts integrations section to show file paths for claude_code, cursor, and codex
closed_at: 2026-01-18T05:32:56.296Z
created_at: 2026-01-18T04:21:35.012Z
dependencies:
  - target: is-01kf7nbezdmr4qwytemnz1mf20
    type: blocks
id: is-01kf7ncg54qrg8g2qvf1mswzy3
kind: task
labels: []
priority: 2
status: closed
title: "Status: Show integration file paths"
type: is
updated_at: 2026-03-09T16:12:31.678Z
version: 8
---
The `tbd status` command Integrations section should show specific file paths.

**Current behavior:**
```
Integrations:
  ✓ Claude Code hooks installed
  ✗ Cursor rules (run: tbd setup cursor)
  ✗ Codex AGENTS.md (run: tbd setup codex)
```

**Expected behavior:**
```
Integrations:
  ✓ Claude Code hooks (~/.claude/settings.json)
  ✗ Cursor rules - not found (.cursor/rules/tbd.mdc)
  ✗ Codex AGENTS.md - not found (./AGENTS.md)
```

**Implementation:**
- Update renderText() Integrations section to show file paths
- Use same path display format as doctor command
