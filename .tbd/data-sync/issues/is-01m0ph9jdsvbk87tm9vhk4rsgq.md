---
type: is
id: is-01m0ph9jdsvbk87tm9vhk4rsgq
title: Build the Rust config-contract probe
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies: []
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:25:32.217Z
updated_at: 2026-08-23T05:25:32.217Z
---
Rust analogue of scripts/check-eslint-contract.mjs. Rust has no --print-config, so the contract check is a probe fixture the lint gate must reject: code that trips each floor lint, plus a CI step asserting clippy fails on it. Without this, the floor can silently go off while the gate stays green.
