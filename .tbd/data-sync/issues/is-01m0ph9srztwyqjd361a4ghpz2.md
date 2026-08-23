---
type: is
id: is-01m0ph9srztwyqjd361a4ghpz2
title: Author the review-code-rust shortcut
kind: task
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0ph9vnqnq5cww3fv22knsyp
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:25:39.743Z
updated_at: 2026-08-23T08:35:07.506Z
closed_at: 2026-08-23T08:35:07.506Z
close_reason: "Completed in PR #258 (branch claude/rust-guidelines-extraction-o9x2yy)."
resolution: null
duplicate_of: null
---
Mirrors review-code-typescript: loads rust-rules and rust-lint-format-rules, performs a Rust-focused review, and checks changed lint, Cargo, or hook config against the rust-lint-format-rules floor. Completes the per-language shortcut set alongside review-code-python and review-code-typescript.
