---
type: is
id: is-01kra99jqbvtjysnr4gc0r7dwm
title: "Q17: Decide lockfile identity (docref-only vs source_id vs full config_hash)"
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
created_at: 2026-05-11T01:09:16.139Z
updated_at: 2026-05-11T01:11:10.527Z
---
Decision required before Phase 2 lockfile work. Depends on Q16.

- A. Keep current shape: docref + revision + content_hash.
- B. Add source_id only: stable manifest-level id; lockfile entries reference it. Solves "same docref twice" and bundle-rename cases.
- C. Full reviewer recommendation: source_id, docref, source_config_hash (hash of materialization-affecting fields), revision, content_hash, materialization.

Q17 Options B/C need source ids, which Q16 Option B introduces.

Spec section: ## Open Questions → Q17 (line ~832).
