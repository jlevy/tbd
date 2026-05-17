---
type: is
id: is-01kra99jbfhknp9jsqfhj9kzbk
title: "Q16: Decide bundle ↔ source cardinality (1:1 vs split)"
kind: task
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies:
  - type: blocks
    target: is-01kra99jqbvtjysnr4gc0r7dwm
  - type: blocks
    target: is-01kra99k339r7jwtw5wdjzbrs5
  - type: blocks
    target: is-01kra98tffpc00qar6ee3zk8tv
parent_id: is-01kra98fgac70pjft7jnarmave
created_at: 2026-05-11T01:09:15.758Z
updated_at: 2026-05-11T01:11:10.238Z
---
Decision required before substantive Phase 2 work; gates Q17/Q18.

- A. Keep 1:1 (current). Simplest; one sources array.
- B. Split bundles from sources. Two top-level arrays: bundles: (priority, hidden, local_root) and sources: (with bundle: reference and stable id:). Multiple sources per bundle.
- C. Optional grouping. Default 1:1; opt-in join-existing-bundle via bundle: <existing-name>.

Use cases cited by reviewer for B: org docs (repo + canonical URLs), tbd Phase 3 migration (small core + external repo), product bundle (refs+examples+code in different repos), multiple URL sources presenting as one bundle.

Spec section: ## Open Questions → Q16 (line ~806).
