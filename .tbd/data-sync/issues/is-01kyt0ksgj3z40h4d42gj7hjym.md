---
type: is
id: is-01kyt0ksgj3z40h4d42gj7hjym
title: "Future: javascript-browser-project-patterns guideline (source-first ESM, checkJs, no build step)"
kind: task
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-07-30T17:19:35.441Z
updated_at: 2026-07-30T17:19:35.441Z
---
Full project-shape guideline for JavaScript-only projects in the kpress/metabrowser mold: source-first native ESM with no bundler or build step, Biome as the single lint/format tool, tsc checkJs strict with scoped includes and a tsconfig.legacy ratchet, browser type generation gates, vendored asset policy, and lefthook/Makefile gate layout. The lint/format floor itself lands in typescript-lint-format-rules; this doc covers the rest of the project shape.
