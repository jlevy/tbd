---
created_at: 2026-01-18T03:20:47.304Z
dependencies: []
id: is-01kf7hx5ysfrbynw0cf54x6brb
kind: task
labels: []
priority: 2
status: open
title: Extract hardcoded content templates to markdown files
type: is
updated_at: 2026-01-18T03:20:57.630Z
version: 2
---
Extract hardcoded content templates from setup.ts into separate markdown files, following the pattern established with SKILL.md.

Templates to extract:
1. CURSOR_RULES_CONTENT → docs/CURSOR_RULES.md (or similar)
2. CODEX_TBD_SECTION → docs/CODEX_SECTION.md (or similar)
3. CODEX_SCAFFOLD → docs/CODEX_SCAFFOLD.md (or similar)

Benefits:
- Easier to edit and maintain content
- Can be formatted with Flowmark
- Consistent with SKILL.md pattern
- Content is version controlled separately from code

Implementation:
1. Create markdown files in docs/
2. Update copy-docs.mjs to copy them during build
3. Update setup.ts to load content from bundled files
4. Add fallback paths for development (like prime.ts does)

This relates to tbd-55c3 (refactor copy-docs.mjs) since the docs list will need updating.
