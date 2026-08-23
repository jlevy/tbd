---
type: is
id: is-01m0r6fjgxf6rfq97v2y6r5r61
title: "PR #258 review R20: do not block risk review on a green generic gate"
kind: bug
status: closed
priority: 2
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wdr6nrtymyeq46b5qnjr
created_at: 2026-08-23T20:55:03.452Z
updated_at: 2026-08-23T21:21:56.759Z
closed_at: 2026-08-23T21:21:56.759Z
close_reason: Fixed in a55041a0 with focused documentation corrections and regression coverage where executable.
---
packages/tbd/docs/guidelines/code-review-rules.md, rust-code-review-rules.md, and review-code-rust.md. Inspect CI first, but a failed/pending low-risk gate must not prevent review of independent high-risk boundaries; the Rust shortcut must also use the repository's supported feature matrix rather than assume --all-features is valid.
