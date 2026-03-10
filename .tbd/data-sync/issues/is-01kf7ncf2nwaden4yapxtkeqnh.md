---
type: is
id: is-01kf7ncf2nwaden4yapxtkeqnh
title: "Setup cursor --check: Show expected rules file path"
kind: task
status: closed
priority: 2
version: 8
labels: []
dependencies:
  - type: blocks
    target: is-01kf7nbezdmr4qwytemnz1mf20
created_at: 2026-01-18T04:21:33.908Z
updated_at: 2026-03-09T16:12:31.672Z
closed_at: 2026-01-18T05:31:37.224Z
close_reason: Updated setup cursor --check to show .cursor/rules/tbd.mdc path using DiagnosticResult
---
The `tbd setup cursor --check` command should show the expected file path.

**Current behavior:**
```
Cursor rules file not found
```

**Expected behavior:**
```
✗ Cursor rules file not found
    Expected: .cursor/rules/tbd.mdc
    Run: tbd setup cursor
```

Or when found:
```
✓ Cursor rules file installed (.cursor/rules/tbd.mdc)
```

**Implementation:**
- Update checkCursorSetup() to show path in output
- Use consistent format with other diagnostic commands
