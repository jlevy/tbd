---
type: is
id: is-01kf5zyg8n2mx06mjhj8fyn9cr
title: Implement tbd prime command
kind: task
status: closed
priority: 1
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T07:22:45.104Z
updated_at: 2026-03-09T16:12:30.116Z
closed_at: 2026-01-17T09:17:52.363Z
close_reason: Implemented in Phase 22-24
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.721Z
    original_id: tbd-1876
---
Implement the tbd prime command that outputs workflow context for AI agents.

**Specification (from design doc 6.4.3):**

```bash
tbd prime [options]

Options:
  --format <fmt>  Output format: markdown (default), json, brief
  --quiet         Suppress output if not in a tbd project (exit 0)
```

**Behavior:**
- Outputs workflow instructions and command reference (~1-2k tokens)
- Exits silently (code 0, no stderr) if not in a tbd project
- Adapts output based on environment (brief for MCP, full for CLI)

**Key design principle:**
Global hooks + project-aware logic. The hooks run on every session, but tbd prime only outputs context when .tbd/ exists.

**Reference files:**
- attic/beads/cmd/bd/prime.go (Beads implementation)
- docs/project/architecture/current/tbd-design-v3.md section 6.4.3
