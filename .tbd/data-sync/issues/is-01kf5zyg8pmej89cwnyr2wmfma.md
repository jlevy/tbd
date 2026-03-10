---
type: is
id: is-01kf5zyg8pmej89cwnyr2wmfma
title: Implement tbd setup codex command
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T16:45:00.000Z
updated_at: 2026-03-09T16:12:30.588Z
closed_at: 2026-01-17T09:17:52.363Z
close_reason: Implemented in Phase 22-24
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.769Z
    original_id: tbd-1882
---
Implement the tbd setup codex command for OpenAI Codex CLI integration.

**Specification:**

```bash
tbd setup codex        # Create/update AGENTS.md with tbd section
tbd setup codex --check  # Verify installation
tbd setup codex --remove # Remove tbd section
```

Creates or updates AGENTS.md in the project root with a managed tbd workflow section using HTML comment markers (similar to beads factory.go approach).

Codex reads AGENTS.md files on session start to get project-specific instructions.

**Reference:**
- https://developers.openai.com/codex/guides/agents-md/
- /tmp/beads-ref/cmd/bd/setup/factory.go (Beads implementation)
