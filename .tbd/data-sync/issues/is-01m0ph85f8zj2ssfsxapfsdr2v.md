---
type: is
id: is-01m0ph85f8zj2ssfsxapfsdr2v
title: Author filesystem-rules guideline
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0ph9qz8k04837d6s7s5dwvr
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:24:46.184Z
updated_at: 2026-08-23T05:25:37.896Z
---
New language-neutral guideline from the nine neutral sections of the playbook's rust-filesystem-rules: planning versus mutation, atomic visibility versus crash durability, backup and collision policy, cross-device moves as copies, deterministic traversal with error propagation, symlink and root boundaries, honest partial failure, and testing the state machine rather than final bytes. Also carries the rationale for this repo's ESLint no-restricted-imports rule, which forbids fs.writeFile in favor of atomically and is currently enforced with no guideline explaining why.
