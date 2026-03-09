---
close_reason: Implemented in Phase 22-24
closed_at: 2026-01-17T09:17:52.363Z
created_at: 2026-01-17T07:22:25.348Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.714Z
    original_id: tbd-1875
id: is-01kf5zyg8ncgqnczpcp9gt5xeg
kind: epic
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 24 Epic: Installation and Agent Integration"
type: is
updated_at: 2026-03-09T02:47:21.411Z
version: 5
---
Implement installation mechanisms and agent integration for tbd. Key components:

1. **tbd prime command** - Output workflow context for agent integration
2. **tbd setup claude** - Install Claude Code hooks (JSON settings and shell hooks)
3. **tbd setup cursor** - Install Cursor editor integration
4. **tbd setup aider** - Install Aider integration
5. **Shell hook generation** - Generate bootstrapping scripts for cloud environments
6. **npm package verification** - Ensure npm package works for cloud auto-installation

Reference: docs/project/architecture/current/tbd-design-v3.md section 6.4
Research: docs/project/research/current/research-beads-bootstrapping-mechanisms.md
