---
type: is
id: is-01m2pr28mh17t3tye60mc3jggs
title: "P1: Contract tests for the review lifecycle"
kind: task
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr2d9920ppbyepz0w9ne4f
  - type: blocks
    target: is-01m2q1n82ewxqyytff9f2sftj2
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:16.496Z
updated_at: 2026-09-17T06:43:54.210Z
---
Plan: Testing Strategy > Contract tests; Implementation Plan Phase 1 item 6. Decision: a new review-lifecycle test file rather than integration-files.test.ts, so it does not collide with other beads.

What: assertions, reading source docs under packages/tbd/docs (no build needed):
- The review and dispositions marker strings and fields (`tbd:review v=1` with id, kind, pr, round, head, base; `tbd:dispositions v=1` with review and head) in pr-review-workflows, and wherever review-github-pr, address-pr-review, review-and-merge-prs, and the three review-code-* shortcuts show them.
- The four dispositions (fixed, rebutted, declined, deferred) defined identically wherever they appear, with no other disposition vocabulary.
- Every Request Vocabulary phrase routed to its shortcut in each skill tier (the README is added in the reference tables bead (tbd-llia)).
- Cross-references among the review shortcuts (review-github-pr, address-pr-review, pr-review-workflows, review-and-merge-prs; each review-code-* shortcut to review-code).
- The one-round default and the confirmation rule.
- In agent-model-tiers: the three tier definitions and the dated "Suggestions as of" block.
Prefer structural assertions over long literal sentences. If an assertion exposes a doc inconsistency, report it to the coordinator rather than editing the doc.

Write set: packages/tbd/tests/review-lifecycle-contract.test.ts (new).

Acceptance: `pnpm --filter get-tbd exec vitest run tests/review-lifecycle-contract.test.ts`; prettier and eslint on the file.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
