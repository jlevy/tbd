---
type: is
id: is-01kf7hx5ysfrbynw0cf54x6brb
title: Extract hardcoded content templates to markdown files
kind: task
status: closed
priority: 2
version: 11
labels: []
dependencies: []
parent_id: is-01kf7j53z1gahrqswh8x4v4b6t
created_at: 2026-01-18T03:20:47.304Z
updated_at: 2026-03-09T16:12:31.458Z
closed_at: 2026-01-26T17:17:10.594Z
close_reason: Hardcoded templates (CURSOR_RULES_CONTENT, CODEX_TBD_SECTION, CODEX_SCAFFOLD) have been removed from setup.ts. Content now dynamically loaded from SKILL.md.
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
