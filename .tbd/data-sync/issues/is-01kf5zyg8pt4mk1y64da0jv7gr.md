---
type: is
id: is-01kf5zyg8pt4mk1y64da0jv7gr
title: Implement tbd setup aider command
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T07:23:01.263Z
updated_at: 2026-03-09T16:12:30.637Z
closed_at: 2026-01-17T09:59:10.225Z
close_reason: Won't implement - aider support not needed
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.744Z
    original_id: tbd-1879
---
Implement the tbd setup aider command for Aider integration.

**Specification (from design doc 6.4.4):**

```bash
tbd setup aider
```

Creates:
- .aider.conf.yml - Config pointing to instructions
- .aider/TBD.md - AI instructions (suggest /run tbd commands)

**Reference files:**
- attic/beads/cmd/bd/setup/aider.go (Beads implementation)
- docs/project/architecture/current/tbd-design-v3.md section 6.4.4
