---
type: is
id: is-01m2nkqsb7pa19qa62h1vr4hf6
title: Align Rust CLI packaging, release, and CI guidelines
kind: task
status: closed
priority: 1
version: 3
delegate: codex@spud10
labels:
  - guidelines
  - rust
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T17:20:24.422Z
updated_at: 2026-09-16T18:07:54.603Z
started_at: 2026-09-16T17:20:35.752Z
closed_at: 2026-09-16T18:07:54.602Z
close_reason: "Rust CLI packaging and release guidance aligned, validated, committed in 63b89430, and published as PR #302 with all CI checks green."
resolution: null
duplicate_of: null
---
Review the Rust CLI, project setup, release engineering, CI/gates, Python CLI, agent skill, and supply-chain guidelines against current evidence from urollup, fdu, flowmark-rs, and official Cargo/uv/Maturin/GitHub/PyPI guidance. Revise the authoritative tbd docs so a new Rust CLI has one coherent path for workspace setup, quality gates, native artifacts, crates.io, optional PyPI Maturin binary wheels for uvx/uv tool install, trusted publishing, rehearsal, packaged-artifact smoke tests, provenance, partial-release recovery, and future Python bindings without implying Python runtime logic. Remove duplication and contradictions, preserve clear ownership between guidelines, update discovery text/tests as needed, validate packaged docs, and open a self-contained PR.
