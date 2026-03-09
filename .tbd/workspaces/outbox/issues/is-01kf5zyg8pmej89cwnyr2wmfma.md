---
close_reason: Implemented in Phase 22-24
closed_at: 2026-01-17T09:17:52.363Z
created_at: 2026-01-17T16:45:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.769Z
    original_id: tbd-1882
id: is-01kf5zyg8pmej89cwnyr2wmfma
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Implement tbd setup codex command
type: is
updated_at: 2026-03-09T02:47:21.718Z
version: 5
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
