---
type: is
id: is-01m2q1ndc8pr5ck5eeta69ww1r
title: "P3: Generate README reference tables and extend contract tests to the README"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2pr2d9920ppbyepz0w9ne4f
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T06:43:01.127Z
updated_at: 2026-09-17T06:45:01.917Z
---
Plan: Implementation Plan Phase 3 item 4; Open Question 3 default (reference tables generated at build time); README Changes items 10, 18, and 19; Final Documentation Updates > Verification (first two bullets).

What:
- Generate the README shortcut, guideline, and template tables (names, one-line descriptions from frontmatter, exact counts) so they cannot drift. Include review-code-rust, new-qa-playbook, suggest-upstream-improvements, architecture-doc (not "architecture"), qa-playbook, and every document this plan adds; address-pr-review's description mentions the four dispositions.
- Add a test that fails when a shortcut, guideline, or template is missing from its table.
- Extend review-lifecycle-contract.test.ts so every Request Vocabulary phrase (plus "You can use sub-agents" and "Set up tbd") must appear in the README request table.
Decision to make and report (judgment): where generation runs, for example copy-docs.mjs prebuild writing marked regions of the committed README with a drift test like the skills/tbd/SKILL.md one, or a separate script. The npm page must stay identical to the GitHub README.

Write set: README.md (table regions only); packages/tbd/scripts/copy-docs.mjs or a new generator under packages/tbd/scripts/; packages/tbd/package.json only if a script entry is needed; packages/tbd/tests/readme-reference-tables.test.ts (new); packages/tbd/tests/review-lifecycle-contract.test.ts.

Acceptance: `pnpm --filter get-tbd exec vitest run tests/readme-reference-tables.test.ts tests/review-lifecycle-contract.test.ts`; Markdown check on README.md; prettier and eslint on changed scripts and tests.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
