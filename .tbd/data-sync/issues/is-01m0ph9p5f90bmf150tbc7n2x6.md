---
type: is
id: is-01m0ph9p5f90bmf150tbc7n2x6
title: "Migrate wave 1: rust-rules, rust-lint-format-rules, rust-project-setup, rust-cli-rules, rust-testing-rules"
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0ph9qz8k04837d6s7s5dwvr
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:25:36.047Z
updated_at: 2026-08-23T08:35:02.915Z
closed_at: 2026-08-23T08:35:02.915Z
close_reason: "Completed in PR #258 (branch claude/rust-guidelines-extraction-o9x2yy)."
resolution: null
duplicate_of: null
---
Apply the conversion checklist to each: relative cross-links become bare guideline names, since ](rust-rules.md) breaks once served from .tbd/docs/; section anchors rewritten; ../SUPPLY-CHAIN-SECURITY.md retargeted at supply-chain-hardening; porting pointers removed, as those documents will not exist in tbd; globs '*.rs' and alwaysApply true added to rust-rules and rust-lint-format-rules; a bolded Related block added under each H1, matching Python and TypeScript; tracker language generalized to 'tracking issue or bead'; common-doc-guidelines footer and flowmark-clean formatting.
