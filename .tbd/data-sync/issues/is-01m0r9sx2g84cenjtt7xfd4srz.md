---
type: is
id: is-01m0r9sx2g84cenjtt7xfd4srz
title: Respect the project's Rust feature matrix in the cross-target gate
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wtrfbn7ryrw82f9r91pw
created_at: 2026-08-23T21:53:07.663Z
updated_at: 2026-08-23T22:48:43.809Z
closed_at: 2026-08-23T22:48:43.798Z
close_reason: "Fixed, fully validated, and pushed in stacked PR #260 through commit 8ae47120; Linux, macOS, Windows, coverage/lint, benchmark, and security checks are green."
resolution: null
duplicate_of: null
---
The stacked check-rust-gate helper unconditionally passes --all-features, contradicting the parent review's requirement to run the project's declared feature matrix. Add explicit Cargo feature options, default to the normal feature set, document repeated invocations for multiple supported combinations, and test argument construction.
