---
created_at: 2026-01-18T03:16:51.253Z
dependencies: []
id: is-01kf7hnzdpcrp8db39nxemw8ej
kind: task
labels: []
priority: 2
status: open
title: Consolidate hardcoded constants into shared settings.ts
type: is
updated_at: 2026-01-18T03:17:00.488Z
version: 2
---
Review the entire codebase for hardcoded constants and settings, then consolidate them into a shared settings.ts file.

Areas to review:
- File paths (TBD_DIR, config paths, skill paths, etc.)
- Default values (priorities, statuses, types)
- Hook configurations (CLAUDE_HOOKS in setup.ts)
- Content templates (CURSOR_RULES_CONTENT, CODEX sections)
- Git settings (MIN_GIT_VERSION, sync branch names)
- ID formats and prefixes
- Any other magic strings or numbers

The settings.ts file should:
- Export typed constants
- Group related settings together
- Include JSDoc comments for documentation
- Be the single source of truth for configuration

This task depends on tbd-55c3 (copy-docs refactor) since that creates the initial settings.ts file.
