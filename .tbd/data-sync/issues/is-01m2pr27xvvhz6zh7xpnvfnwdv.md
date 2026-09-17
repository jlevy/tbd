---
type: is
id: is-01m2pr27xvvhz6zh7xpnvfnwdv
title: "P1: Update address-pr-review for markers, lettered IDs, and four dispositions"
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr28mh17t3tye60mc3jggs
  - type: blocks
    target: is-01m2pr2bttb3sw9d036ejwtp4t
  - type: blocks
    target: is-01m2q2590d5x1nx544vc8f42a3
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:15.770Z
updated_at: 2026-09-17T06:51:40.940Z
---
Plan: Document Changes row address-pr-review; Review-State Contract (Dispositions, Disposition replies, Discovery sweep); Roles (escalation); README Changes item 18 (describe address-pr-review with four dispositions).

What: detect an addressed review by a later `tbd:dispositions` marker for its letter that lists every finding (reply titles no longer matter), replacing the "Addressed ... in <commit>" title convention; use lettered finding IDs (unmarked reviews keep their IDs, referenced by review URL plus ID) in bead titles and replies; exactly four dispositions (fixed, rebutted, declined, deferred) with the evidence rules from the plan's table, used consistently in steps 3, 8, and 9; confirm fixes with an automated test per the testing guidelines, or a manual test script or runbook (`tbd shortcut new-qa-playbook`) when automation is very difficult; the marked disposition reply format; escalate to the coordinator when a fix needs a design decision, when rebutting or declining a Blocker or High finding, or when findings conflict; a condensed report for a coordinator (new head SHA, CI run IDs, reply URL, bead IDs). Update the frontmatter description to mention the four dispositions. Keep the stacked-PR steps that integration-files.test.ts pins.

Write set: packages/tbd/docs/shortcuts/standard/address-pr-review.md.

Acceptance: Markdown check; `pnpm --filter get-tbd exec vitest run tests/integration-files.test.ts` passes (read-only).

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
