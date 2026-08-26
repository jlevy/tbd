---
type: is
id: is-01m0xrr0961kddfbw1gexkpckq
title: Make check-rust-gate.mjs follow the TypeScript and JavaScript guidelines
kind: bug
status: closed
priority: 1
version: 3
labels: []
dependencies: []
created_at: 2026-08-26T00:50:26.199Z
updated_at: 2026-08-26T01:21:11.171Z
closed_at: 2026-08-26T01:21:11.169Z
close_reason: Documented the standalone Rust gate helper with file-level rationale and concise JSDoc, enforced strict checked-JavaScript typechecking and type-aware ESLint on it, validated untyped Cargo metadata, distinguished usage errors from gate failures, completed help text, and added focused behavioral and config-contract tests. Full local, pre-push, and GitHub CI passed.
resolution: null
duplicate_of: null
---
The file packages/tbd/docs/guidelines/scripts/check-rust-gate.mjs does not follow our own TypeScript or JavaScript guidelines. It is not commented or has no explanatory text. Read the relevant guidelines and make sure this is rigorously followed.
