---
type: is
id: is-01kf5zyg8p786yx9vr2kp6yw1f
title: Implement tbd setup cursor command
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T07:22:56.655Z
updated_at: 2026-03-09T16:12:30.503Z
closed_at: 2026-01-17T09:17:52.363Z
close_reason: Implemented in Phase 22-24
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.736Z
    original_id: tbd-1878
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
