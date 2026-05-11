---
type: is
id: is-01kra99kg4z987hjrwwrj5wh4q
title: "Q19: Decide as: field disambiguation (keep vs mode: discriminator vs KDEX-aligned)"
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies:
  - type: blocks
    target: is-01kra98tffpc00qar6ee3zk8tv
parent_id: is-01kra98fgac70pjft7jnarmave
created_at: 2026-05-11T01:09:16.932Z
updated_at: 2026-05-11T01:11:11.125Z
---
as: currently means two unrelated things:
- On a source: "treat this source as a single named item rather than a bag of files" (whole-repo/single-URL mode).
- On a contents rule: "rename this upstream doc on import."

Options:
- A. Keep as-is and document the two meanings.
- B. Split into mode: discriminator on sources (files|file|repo); as: only on contents rules as rename semantics. Cleanest.
- C. KDEX-aligned: as: repo literal; as: <name> only on contents rules.

Spec section: ## Open Questions → Q19 (line ~891).
