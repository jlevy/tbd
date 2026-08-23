---
type: is
id: is-01m0phan84kmbf3jpzgm8bzztc
title: "Playbook: reduce test_rust_guidelines.py to what remains local"
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels:
  - playbook
dependencies: []
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:26:07.875Z
updated_at: 2026-08-23T05:26:07.875Z
---
The structure regressions currently assert against the seven Rust guidelines. After the move, keep the porting-layer assertions and drop the ones covering documents that now live in tbd. Confirm the porting layer still reads correctly with the general layer external: every target-side rule it relies on resolves through tbd.
