---
close_reason: Implemented in Phase 22-24
closed_at: 2026-01-17T09:17:52.363Z
created_at: 2026-01-17T07:22:56.655Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.736Z
    original_id: tbd-1878
id: is-01kf5zyg8p786yx9vr2kp6yw1f
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Implement tbd setup cursor command
type: is
updated_at: 2026-03-09T02:47:21.649Z
version: 5
---
Implement the tbd setup cursor command for Cursor IDE integration.

**Specification (from design doc 6.4.4):**

```bash
tbd setup cursor
```

Creates .cursor/rules/tbd.mdc with workflow instructions that Cursor loads automatically.

**Reference files:**
- attic/beads/cmd/bd/setup/cursor.go (Beads implementation)
- docs/project/architecture/current/tbd-design-v3.md section 6.4.4
