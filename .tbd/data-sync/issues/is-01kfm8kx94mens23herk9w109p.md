---
close_reason: "Implemented: docs/headers/ + docs/skill.md structure with build composition. SKILL.md and CURSOR.mdc are now generated from shared content."
closed_at: 2026-01-23T02:56:22.200Z
created_at: 2026-01-23T01:48:33.956Z
dependencies:
  - target: is-01kfm8m50c6d1qdyef2ctjrew7
    type: blocks
  - target: is-01kfm8m5bjfhh38tt4jd955yw9
    type: blocks
  - target: is-01kfm8m5n9bjcnkdxbvv0cchpq
    type: blocks
  - target: is-01kfm8vmcx5a2ttpaf2v54dgpd
    type: blocks
  - target: is-01kfm8yhtjp0fvdm2ptmgtr0dz
    type: blocks
  - target: is-01kf7j53z1gahrqswh8x4v4b6t
    type: blocks
id: is-01kfm8kx94mens23herk9w109p
kind: feature
labels: []
priority: 2
status: closed
title: Consolidate SKILL.md and CURSOR.mdc into single source of truth
type: is
updated_at: 2026-01-23T02:56:22.201Z
version: 9
---
Create single source of truth for agent docs:

**Target structure:**
- docs/skill.md - Main skill content (shared across all platforms)
- docs/skill-brief.md - Brief version (already exists, clean markdown)
- docs/headers/claude.md - Claude YAML frontmatter (name, description, allowed-tools)
- docs/headers/cursor.md - Cursor YAML frontmatter (description, alwaysApply)

**Build output:**
- SKILL.md = headers/claude.md + skill.md
- CURSOR.mdc = headers/cursor.md + skill.md

This eliminates duplication between SKILL.md and CURSOR.mdc which currently have nearly identical content with different frontmatter.
