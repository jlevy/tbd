---
type: is
id: is-01m0phadvepybz953kjh2r6skr
title: "Playbook: consume the migrated Rust guidelines from tbd"
kind: task
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels:
  - playbook
dependencies:
  - type: blocks
    target: is-01m0phahhe6a03e4nwk7h4kzhs
  - type: blocks
    target: is-01m0phakcptq9kf2219qpva7wk
  - type: blocks
    target: is-01m0phan84kmbf3jpzgm8bzztc
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:26:00.302Z
updated_at: 2026-08-23T05:26:07.875Z
---
Once tbd serves the Rust family, replace each migrated guideline in the playbook's guidelines/ with an internal: docref in .tbd/config.yml, so the playbook loads tbd's copy the way it already loads the TypeScript family. This is what turns the migration into a consolidation rather than a fork. The porting documents stay local permanently: they exist only when another implementation is authoritative.
