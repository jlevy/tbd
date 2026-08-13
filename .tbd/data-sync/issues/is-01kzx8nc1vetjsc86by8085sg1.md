---
type: is
id: is-01kzx8nc1vetjsc86by8085sg1
title: Render accessible Linear and GitHub link marks in bead rows and details
kind: feature
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - web
  - integration
dependencies:
  - type: blocks
    target: is-01kzx8ncczb69sp1bgyk20pyt5
parent_id: is-01kzx8mkeyergsd0hmq8zj1zd7
created_at: 2026-08-13T09:53:40.922Z
updated_at: 2026-08-13T15:59:38.821Z
extensions:
  linear:
    id: d3e91620-a20f-4d0f-aec7-ce509ea7082f
    linked_at: 2026-08-13T15:59:38.821Z
---
In src/web/core.ts add strict ExternalLinkView parsing and state types; in src/web/client.ts renderExternalLinks() from renderRow() and renderLoadedBody(). Use one compact Links column with recognizable inline GitHub and Linear SVG marks, provider-semantic tooltip and accessible name, key on hover/focus, direct target=_blank links with rel=noopener noreferrer, and click propagation stopped so navigation does not expand the bead. In styles.css reuse design tokens for icon weight, muted/hover/focus states, dark mode, motion, and table widths; no icon library or per-row duplicate SVG DOM. Expanded/collapsed rows must retain fixed column widths. Pin DOM, accessibility, CSS, copy, and performance behavior in web client/core/CSS tests.
