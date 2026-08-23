---
type: is
id: is-01m0ph9qz8k04837d6s7s5dwvr
title: "Migrate wave 2: the three split Rust documents"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0ph9srztwyqjd361a4ghpz2
  - type: blocks
    target: is-01m0ph9vnqnq5cww3fv22knsyp
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:25:37.896Z
updated_at: 2026-08-23T08:35:04.015Z
closed_at: 2026-08-23T08:35:04.015Z
close_reason: "Completed in PR #258 (branch claude/rust-guidelines-extraction-o9x2yy)."
resolution: null
duplicate_of: null
---
rust-filesystem-rules keeps Path and OsStr types and platform metadata; rust-release-rules keeps crates.io trusted publishing and maturin wheels; rust-code-review-rules keeps unsafe and FFI review. Each routes at its shared guideline rather than restating it. Same conversion checklist as wave 1.
