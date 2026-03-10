---
type: is
id: is-01kf7nccjfqg3mz4ash9sf10gc
title: "Setup claude --check: Show file paths in output"
kind: task
status: closed
priority: 2
version: 8
labels: []
dependencies:
  - type: blocks
    target: is-01kf7nbezdmr4qwytemnz1mf20
created_at: 2026-01-18T04:21:31.342Z
updated_at: 2026-03-09T16:12:31.660Z
closed_at: 2026-01-18T05:31:35.707Z
close_reason: Updated setup claude --check to use DiagnosticResult with paths for global hooks, project hooks, and skill file
---
The `tbd setup claude --check` command should show the specific file paths being checked.

**Current behavior:**
```
✓ Claude Code hooks installed
✓ Skill file installed
```

**Expected behavior:**
```
✓ Claude Code hooks installed (~/.claude/settings.json)
✓ Skill file installed (.claude/skills/tbd/SKILL.md)
```

Or when not installed:
```
⚠ Claude Code hooks not configured
    Expected: ~/.claude/settings.json
    Run: tbd setup claude
✗ Skill file not found
    Expected: .claude/skills/tbd/SKILL.md
    Run: tbd setup claude
```

**Implementation:**
- Update checkClaudeSetup() to include paths in output
- Use consistent format with doctor command (path in parentheses)
