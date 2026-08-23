---
type: is
id: is-01m0r6fgpf5qm016pfa56706fv
title: "PR #258 review R15: make lint-cost measurement fail closed"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wdr6nrtymyeq46b5qnjr
created_at: 2026-08-23T20:55:01.582Z
updated_at: 2026-08-23T21:21:56.720Z
closed_at: 2026-08-23T21:21:56.720Z
close_reason: Fixed in a55041a0 with focused documentation corrections and regression coverage where executable.
---
scripts/measure-rust-lint-cost.mjs. A nonzero clippy run is accepted whenever it emitted any stdout, so compilation failure can publish a partial table. Require successful locked Cargo runs, correct the CLI documentation, clean scratch build directories, and add a negative test.
