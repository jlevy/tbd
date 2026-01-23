---
close_reason: "Implemented: copy-docs.mjs uses COMPOSED_FILES constant for headers + content paths. Removed hardcoded SKILL.md/CURSOR.mdc from DOCS_FILES."
closed_at: 2026-01-23T02:56:22.704Z
created_at: 2026-01-18T03:16:51.253Z
dependencies:
  - target: is-01kf7j53z1gahrqswh8x4v4b6t
    type: blocks
id: is-01kf7hnzdpcrp8db39nxemw8ej
kind: task
labels: []
priority: 2
status: closed
title: Consolidate hardcoded constants into shared settings.ts
type: is
updated_at: 2026-01-23T02:56:22.705Z
version: 4
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
