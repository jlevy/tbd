---
type: is
id: is-01m0r2dtqtk5yrjntrd9v5m89q
title: "Remove gratuitous guideline rewrites from PR #260"
kind: bug
status: closed
priority: 1
version: 4
spec_path: docs/project/reviews/review-2026-08-23-pr258-holistic-engineering-guidelines.md
labels: []
dependencies: []
parent_id: is-01m0qxb2r48hpyfvzbpbcrnh3w
created_at: 2026-08-23T19:44:12.025Z
updated_at: 2026-08-23T20:40:50.407Z
closed_at: 2026-08-23T20:40:50.405Z
close_reason: Broad guideline rewrites removed; original specificity restored and only concrete corrections retained. Corrective commit pushed and all local/GitHub checks passed.
resolution: null
duplicate_of: null
---
Audit every guideline changed by the stacked PR against its PR #258 version. Restore the author's wording, specificity, examples, and structure wherever the stack made a broad rewrite. Retain only narrow corrections tied to a concrete review finding, with a minimal diff and no change of voice without necessity.

## Notes

Corrective commit 2c7f39e6 removed the broad rewrite, duplicate CLI guideline, and extra routing layer. The combined PR leaves general-eng-agent-principles and the parent general/testing/review/error/filesystem and Rust CLI/review/release/testing prose byte-for-byte unchanged; retained edits are tied to specific write-contract, gate, routing-budget, or Node stream-outcome defects. Local CI passed 162 files and 2,436 tests; every GitHub check passed.
