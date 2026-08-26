---
title: Review Code (Rust)
description: Rust-focused code review (language-specific rules only)
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut performs a **Rust-focused** code review, checking Rust-specific
correctness, soundness, API design, and antipatterns.

For a **comprehensive review** that includes general coding rules, error handling,
comment quality, and testing practices, use `tbd shortcut review-code` instead.
For the full PR review lifecycle (publishing and addressing reviews), see
`tbd shortcut pr-review-workflows`.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Identify the code to review:
   - If changes are staged, review `git diff --cached`
   - If changes are unstaged, review `git diff`
   - Or review specific files the user mentions

2. Load the review process and the Rust rules:
   - Run `tbd guidelines code-review-rules rust-code-review-rules`
   - Run `tbd guidelines rust-rules rust-lint-format-rules`

3. Add the topic guidelines that match the changed surface (full table in
   `rust-code-review-rules`):
   - Cargo layout, features, toolchains, workspace shape: `rust-project-setup`
   - Arguments, streams, terminal behavior, exits: `rust-cli-rules`
   - Paths, traversal, file mutation, metadata: `filesystem-rules rust-filesystem-rules`
   - Tests, fixtures, snapshots, matrices, coverage: `rust-testing-rules`
   - Artifacts, publishing, version identity:
     `release-engineering-rules rust-release-rules`
   - Lint config, `clippy.toml`, rustfmt, CI gates: `ci-and-gates-rules`
   - Dependencies added or upgraded: `supply-chain-hardening`

4. Inspect the repository’s documented automated gate before spending review time on
   what it owns. If the repository has no gate, the commands below are a baseline only
   when its feature model permits `--all-features`:
   - `cargo fmt --all -- --check`
   - `cargo clippy --locked --workspace --all-targets --all-features -- -D warnings`
   - `cargo test --locked --workspace --all-features`

   For mutually exclusive features, run the supported feature matrix instead of forcing
   an invalid `--all-features` build.
   If the gate is missing, disabled, or failed, record that finding and continue with
   independent higher-risk review work.
   If the diff touches `cfg(target_os)` code, check whether it is linted for those
   targets at all—a single-platform CI run does not.

5. Review the highest-risk boundaries first, in the order `code-review-rules` defines.
   Start with unsafe code and FFI, using the checklist in `rust-code-review-rules`.

6. Run the quick scan for Rust-specific patterns (`rust-code-review-rules`), then read
   the changed control flow rather than stopping at the matches.

7. Summarize findings in the format `code-review-rules` specifies (severity,
   `file:line`, violated contract, concrete failure path, bounded fix).

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
