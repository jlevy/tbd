---
close_reason: Updated setup cursor --check to show .cursor/rules/tbd.mdc path using DiagnosticResult
closed_at: 2026-01-18T05:31:37.224Z
created_at: 2026-01-18T04:21:33.908Z
dependencies:
  - target: is-01kf7nbezdmr4qwytemnz1mf20
    type: blocks
id: is-01kf7ncf2nwaden4yapxtkeqnh
kind: task
labels: []
priority: 2
status: closed
title: "Setup cursor --check: Show expected rules file path"
type: is
updated_at: 2026-03-09T16:12:31.672Z
version: 8
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
