---
type: is
id: is-01m0ph9gm4vzmq2vn5dddhjnm3
title: Validate the Rust lint floor against a real codebase
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies: []
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:25:30.372Z
updated_at: 2026-08-23T05:25:30.372Z
---
The floor table is a design proposal, not a validated configuration. Run the proposed [lints] block and clippy.toml against flowmark-rs, which is first-party and the playbook's primary case study. Record which lints fire, which are noise, and which need a project exception. Open question to settle with evidence: whether clippy::indexing_slicing is tolerable codebase-wide or needs test-file scoping, the way tbd scopes its no-unsafe-* relaxations to tests.
