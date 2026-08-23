---
type: is
id: is-01m0phafp707w8m9vwq9691f0z
title: "Playbook: record the disposition of every moved document"
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels:
  - playbook
dependencies: []
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:26:02.183Z
updated_at: 2026-08-23T05:26:02.183Z
---
Record in _meta/playbook-improvement-log.md which file moved, to which tbd name, and at which commit. Git history holds the content; the log holds the mapping, so a future reader can trace any rule to its current home. Covers the seven Rust guidelines plus the sections split into filesystem-rules, release-engineering-rules, code-review-rules, and ci-and-gates-rules.
