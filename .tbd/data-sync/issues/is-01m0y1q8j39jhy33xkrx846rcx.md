---
type: is
id: is-01m0y1q8j39jhy33xkrx846rcx
title: Review ci-and-gates-rules.md for accuracy, duplication, and brevity
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:19.106Z
updated_at: 2026-08-26T03:53:04.735Z
closed_at: 2026-08-26T03:53:04.734Z
close_reason: "Reviewed. 1 edit (wordiness). All 7 factual claims verified: bash pipeline negation tested, lefthook priority, npx/dlx/bunx fetch behavior, check-eslint-contract and check-rust-gate flags checked against the real scripts. The 3 gate-verification sections are distinct (mechanisms / failure modes / checklist) and were kept."
resolution: null
duplicate_of: null
---
Review `packages/tbd/docs/guidelines/ci-and-gates-rules.md` (420 lines, new).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## Brevity and duplication (the main risk here)

This is the longest new document. Three sections make overlapping arguments about
proving a gate works: “Keep a Known Violation for Every Required Gate”, “Prevent Gates
From Passing Without Running Their Checks”, and “Verify Every Gate With a Known
Failure”. Decide whether that is one idea stated three times or three distinct
mechanisms, and consolidate if it is the former.

Check duplication against the documents this one hands off to and from:
`rust-lint-format-rules` (the cross-target lint pass is stated in both),
`general-testing-rules` (ambient `GIT_DIR` state, timeout raises, and machine-specific
fixtures all appear in both), `filesystem-rules`, `supply-chain-hardening` (pinning and
install scripts).

## Factual claims to verify

- The pipeline-exit-status example: that a failing `cargo tree` leaves `grep` with empty
  input, `grep` returns 1, and the leading `!` inverts that to 0. Confirm the `!` binds
  to the pipeline, not the first command.
- `set -o pipefail` portability claim.
- lefthook: that `priority` is honored only when `parallel: false` or `piped: true`.
  Check the lefthook documentation for the version this repo pins.
- That `npx`, `pnpm dlx`, and `bunx` fetch and execute an absent dependency, while
  `pnpm exec` and `bun run` fail instead.
- The `check-eslint-contract.mjs` excerpt matches the real script in this repo, and
  `@typescript-eslint/use-unknown-in-catch-callback-variable` is in fact a strict-preset
  rule configured nowhere explicitly.
- The `check-rust-gate.mjs cross-targets` invocations match the shipped script’s actual
  flags and modes (`packages/tbd/docs/guidelines/scripts/check-rust-gate.mjs`).
- The `#[expect(lint, reason = "...")]` behavior claim.
