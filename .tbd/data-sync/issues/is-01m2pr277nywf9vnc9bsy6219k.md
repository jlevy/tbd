---
type: is
id: is-01m2pr277nywf9vnc9bsy6219k
title: "P1: Update review-code and code-review-rules for pinned heads, tests, and full finding reports"
kind: task
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr2chxhjtktht45z3r4155
  - type: blocks
    target: is-01m2pr28mh17t3tye60mc3jggs
  - type: blocks
    target: is-01m2q2590d5x1nx544vc8f42a3
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T03:55:15.060Z
updated_at: 2026-09-17T10:15:06.948Z
started_at: 2026-09-17T09:56:36.306Z
closed_at: 2026-09-17T10:15:06.948Z
close_reason: "Batch 2 verified by the coordinator: rebuilt dist and skills copy; 146 tests in the 9 acceptance files passed; typecheck, eslint, prettier, and flowmark clean; tbd policy smoke-tested; committed one commit per bead"
resolution: null
duplicate_of: null
---
Plan: Document Changes rows review-code and code-review-rules; Review-State Contract > Pinning and the working tree; Implementation Plan Phase 1 items "Update review-code" and "update code-review-rules".

What:
- review-code: for PR scope, review the pinned head checked out in the working tree (the diff alone is not enough, since surrounding code must come from that head); encourage running the test suite and targeted reproduction scripts unless the user says otherwise; scratch files go in the session scratch directory; no commits or pushes; leave the tree as found; report every finding with its severity (no filtering by severity); use the finding IDs and header defined in pr-review-workflows.
- code-review-rules: point the finding format to the contract in pr-review-workflows, and state that reviewers report every finding with its severity.
Keep the TypeScript lint/format floor routing that integration-files.test.ts checks for review-code.md.

Write set: packages/tbd/docs/shortcuts/standard/review-code.md; packages/tbd/docs/guidelines/code-review-rules.md.

Acceptance: Markdown check; `pnpm --filter get-tbd exec vitest run tests/integration-files.test.ts tests/guideline-budget.test.ts` pass (read-only).

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
