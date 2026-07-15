---
type: is
id: is-01kxj31xy6xj3s5b2e8h485tte
title: Restructure skill guidance into a concise core and one-level references
kind: task
status: open
priority: 1
version: 7
labels:
  - documentation
  - agent-skills
dependencies:
  - type: blocks
    target: is-01kxj31ya0j51x4tjbfehrhbva
  - type: blocks
    target: is-01kxj31ym97hbdhzs0tpf8bzjj
  - type: blocks
    target: is-01kxj31yy0vb595rat94gsdr2f
  - type: blocks
    target: is-01kxj31z8kb3ah2x1k0wmjbm0w
  - type: blocks
    target: is-01kxj31zjvcsgpdtb33r37nqjc
  - type: blocks
    target: is-01kxj31zwqhycex8wpptw3srga
parent_id: is-01kxj30jgtpk96nys50nr6peve
created_at: 2026-07-15T05:12:38.597Z
updated_at: 2026-07-15T05:13:43.740Z
---
Structurally split packages/tbd/docs/guidelines/cli-agent-skill-patterns.md before the substantive content rewrite.

Acceptance criteria:
- Keep a decision-oriented core of at most about 500 lines covering the principle, skill basics, the L0-L2b ladder, and direct routes to deeper material.
- Move L3 platform internals, hook matrices, MCP comparisons, marketplace surveys, volatile per-agent details, and long worked examples into focused packages/tbd/docs/references/*.md documents.
- Every deeper document is linked directly from the core and states exactly when to load it; no reference-to-reference chains are required for the workflow.
- Preserve historical/source attribution and the documentation footer.
- Make the structural move separately from behavioral wording changes where practical, and keep tbd guidelines plus tbd docs show routes discoverable.
