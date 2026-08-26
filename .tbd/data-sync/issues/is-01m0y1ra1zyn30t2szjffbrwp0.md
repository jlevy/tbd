---
type: is
id: is-01m0y1ra1zyn30t2szjffbrwp0
title: Review the Python-family and smaller cross-language edits
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:53.407Z
updated_at: 2026-08-26T03:53:55.119Z
closed_at: 2026-08-26T03:53:55.118Z
close_reason: "Reviewed. 1 edit (python-rules restated exception categories owned elsewhere). Strif's API verified against installed strif 3.1.0 source: atomic_output_file / atomic_write_text / atomic_write_bytes all exist, argument order is path-then-content as documented, backup_suffix does move the old destination first (docstring confirms the brief absence), and Strif does not fsync."
resolution: null
duplicate_of: null
---
Review the Python-family and smaller cross-language edits in this PR:
`python-modern-guidelines.md` (§Atomic Output Files rewritten),
`python-rules.md`, `error-handling-rules.md` (broken-pipe addition),
`release-notes-guidelines.md`, `golden-testing-guidelines.md`, and
`supply-chain-hardening.md`.
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## Factual claims to verify

- **Strif’s API.** That `atomic_output_file`, `atomic_write_text`, and
  `atomic_write_bytes` exist with those exact names and signatures, and that
  `make_parents` and `backup_suffix` are real parameters.
  Check the actual package, not memory.
- **The `backup_suffix` warning**: that Strif moves the old destination to the backup
  before installing the new one, leaving the destination briefly absent.
  This is a specific behavioral claim about someone else’s library—confirm it against
  the source or retract it.
- That Strif provides atomic visibility but does not promise the replacement survives
  power loss.
- The `error-handling-rules` addition: the three failure modes of a naive EPIPE handler,
  and the claim that a handler at the executable boundary sees only an error kind and
  not which stream produced it.
- The `supply-chain-hardening` one-line change replaces a real tag with the placeholder
  `actions/checkout@<40-hex-sha>`. Confirm a placeholder is intended here rather than a
  real pinned SHA, and that it is consistent with how the repository’s own workflows and
  `scripts/check-action-pins.mjs` express pins.

## Brevity and duplication

- The atomic-publication rationale now appears in `python-modern-guidelines`,
  `python-rules`, `typescript-rules`, and `filesystem-rules`.
  `python-rules`’ new six-line bullet largely restates `python-modern-guidelines`;
  check whether a reference would do.
- The `error-handling-rules` addition against `rust-cli-rules` and
  `typescript-cli-tool-rules`, which each restate part of the same contract.
- `golden-testing-guidelines`’ portability bullet against `general-testing-rules`
  §Prefer Language-Neutral Tests.
