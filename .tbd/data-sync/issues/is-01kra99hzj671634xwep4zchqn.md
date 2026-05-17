---
type: is
id: is-01kra99hzj671634xwep4zchqn
title: "Q15: Decide resolver semantics (priority-only vs DocGraph+DocMap policy view)"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies:
  - type: blocks
    target: is-01kra98tffpc00qar6ee3zk8tv
parent_id: is-01kra98fgac70pjft7jnarmave
created_at: 2026-05-11T01:09:15.378Z
updated_at: 2026-05-11T01:11:09.933Z
---
Decision required before substantive Phase 2 work. Three options:
- A. Keep current shape (resolveLookupKey takes flat priority-ordered array, returns one entry).
- B. Add typed mode parameter ({type?, mode? in: effective|all|strict}). Minimum-viable response to design review.
- C. Two-layer DocGraph (lossless inventory) + DocMap (policy view). Cleanest separation; biggest refactor; right shape if/when docref+docmap get extracted.

Open: do typed commands pass type constraint at call site, or does dispatcher inject it?

Spec section: ## Open Questions → Q15 (line ~775).
Source: PR #117 senior-design review comment from jlevy, point 1.
