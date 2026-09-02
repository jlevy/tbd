---
type: is
id: is-01m0y1r10ef89f15ypzq3mdt1z
title: Review the rewritten general-testing-rules.md for preservation, accuracy, and brevity
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:44.142Z
updated_at: 2026-08-26T03:53:37.745Z
closed_at: 2026-08-26T03:53:37.745Z
close_reason: "Reviewed. 1 edit (paragraph restating the section below it). Note: the PR description's claim that the original core was 'restored verbatim' is false, all six original bullets were reworded. The rewrites are more specific so they were kept, but the PR body needs correcting. bridge-merge/5472ms example confirmed real."
resolution: null
duplicate_of: null
---
Review `packages/tbd/docs/guidelines/general-testing-rules.md` (grew from ~35 lines to
~204 in this PR). Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

This is the highest-stakes brevity review in the epic: the document is short and
frequently loaded, and the PR replaced a terse six-bullet original with ten sections.

## What to check

- **Verify the preservation claim.** The PR body states the original core was “restored
  verbatim, with new evidence guidance kept as a separate addition rather than a
  stylistic rewrite.” Diff against `main` and confirm. If original bullets were reworded
  rather than kept, that is a finding under the epic’s no-blanket-rewrite rule.
- **Duplication with `ci-and-gates-rules`**, which states the same three things: the
  ambient `GIT_DIR` hook trap, the timeout-raise-with-measurement rule (both carry a
  worked example), and machine-specific committed fixtures.
  Each should live in exactly one document with a one-line reference from the other.
- The five-property list (concision, clarity, coverage, efficiency, portability) against
  the sections that follow—check whether the list is a real frame or a preamble the
  sections do not use.
- §Prefer Language-Neutral Tests overlaps the addition made to
  `golden-testing-guidelines` in this same PR.
- The `testTimeout: isWindows ? 20000 : 5000` example: confirm the 5472ms figure and the
  `bridge-merge` reference correspond to something real in this repository, or make the
  example generic.

## Factual claims to verify

- That an empty test selection exits zero and prints green in the runners named.
- The vacuous-test examples are actually vacuous as written.
