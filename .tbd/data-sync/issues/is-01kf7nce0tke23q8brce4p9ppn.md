---
type: is
id: is-01kf7nce0tke23q8brce4p9ppn
title: "Setup codex --check: Show full AGENTS.md path"
kind: task
status: closed
priority: 2
version: 8
labels: []
dependencies:
  - type: blocks
    target: is-01kf7nbezdmr4qwytemnz1mf20
created_at: 2026-01-18T04:21:32.825Z
updated_at: 2026-03-09T16:12:31.667Z
closed_at: 2026-01-18T05:31:36.474Z
close_reason: Updated setup codex --check to show full ./AGENTS.md path using DiagnosticResult
---
The `tbd setup codex --check` command should show the full file path being checked.

**Current behavior:**
```
⚠ AGENTS.md exists but no tbd section found
  Run: tbd setup codex (to add tbd section)
```

or:
```
AGENTS.md not found
  Run: tbd setup codex
```

**Expected behavior:**
```
⚠ AGENTS.md exists but no tbd section found (./AGENTS.md)
  Run: tbd setup codex
```

or:
```
✗ AGENTS.md not found
    Expected: ./AGENTS.md
    Run: tbd setup codex
```

**Implementation:**
- Update checkCodexSetup() to include path in all output messages
- Use consistent format with other diagnostic commands
