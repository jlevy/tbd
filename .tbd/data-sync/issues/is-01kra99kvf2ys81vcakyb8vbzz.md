---
type: is
id: is-01kra99kvf2ys81vcakyb8vbzz
title: "Q20: Decide categories/types/folders, glob-first matching, CLI aliases"
kind: epic
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies:
  - type: blocks
    target: is-01kra9a8ae405nqc2mh0jfd8zf
parent_id: is-01kra98fgac70pjft7jnarmave
created_at: 2026-05-11T01:09:17.295Z
updated_at: 2026-05-11T01:11:11.422Z
---
Q20 has sub-decisions (Q20a-f). Per spec linkage section: Q20a+b+c can ship together in Phase 1 schema (rename + glob-first contents); Q20d is implicit; Q20e (CLI alias generation) can happen later in Phase 1 or early Phase 2.

- Q20a. Rename type → category. Lean: B (category).
- Q20b. Glob-only matching, no auto-detection. Lean: B (glob-only).
- Q20c. contents rule shape (path: vs glob:). Lean: B (rename to glob:).
- Q20d. Folder layout vs category assignment (decouple). Lean: B.
- Q20e. CLI commands as validated aliases over generic tbd doc. Lean: B (alias-driven).
- Q20f. Frontmatter category: as auto-assignment with strict precedence (per-file metadata > frontmatter > contents rule > none). Lean: C.

Spec section: ## Open Questions → Q20 (line ~917).
