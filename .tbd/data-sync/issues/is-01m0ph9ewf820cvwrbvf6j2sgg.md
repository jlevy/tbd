---
type: is
id: is-01m0ph9ewf820cvwrbvf6j2sgg
title: Author rust-lint-format-rules, the strict Rust floor
kind: feature
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0ph9gm4vzmq2vn5dddhjnm3
  - type: blocks
    target: is-01m0ph9jdsvbk87tm9vhk4rsgq
  - type: blocks
    target: is-01m0ph9m9kt4tv25sbhht10a20
  - type: blocks
    target: is-01m0ph9p5f90bmf150tbc7n2x6
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:25:28.591Z
updated_at: 2026-08-23T05:25:36.047Z
---
New guideline mirroring typescript-lint-format-rules section for section: The Floor, The [lints] Floor, Hooks and Gates, Verifying the Floor. Every rule derives from something already enforced: cargo fmt and taplo for formatting; clippy with -D warnings as a verify-only gate; unsafe_code forbid and RUSTDOCFLAGS -D warnings as the separate strict gate; pedantic at warn with priority -1; clippy::indexing_slicing for noUncheckedIndexedAccess; clippy::wildcard_enum_match_arm for exhaustiveness; clippy::let_underscore_future and unused_must_use for no-floating-promises; clippy.toml disallowed-methods naming std::fs::write and File::create for the atomic-write restriction; unwrap_used and expect_used denied outside tests; #[expect(reason)] for narrow exceptions, which improves on the TypeScript equivalent because it warns once the suppression is unnecessary. No profile layer: Rust has one formatter and one linter, so the document should be shorter than its model.
