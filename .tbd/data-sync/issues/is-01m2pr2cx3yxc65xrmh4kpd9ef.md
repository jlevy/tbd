---
type: is
id: is-01m2pr2cx3yxc65xrmh4kpd9ef
title: "P2: Policy alignment, setup-tbd, and new-document route tests"
kind: task
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr2d9920ppbyepz0w9ne4f
  - type: blocks
    target: is-01m2q1n82ewxqyytff9f2sftj2
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T03:55:20.866Z
updated_at: 2026-09-17T11:44:55.819Z
started_at: 2026-09-17T11:34:41.513Z
closed_at: 2026-09-17T11:44:55.819Z
close_reason: Coordinator ran both files (49 tests passed), typecheck, eslint, prettier clean; agents mutation-tested the checks; committed
resolution: null
duplicate_of: null
---
Plan: Testing Strategy > Policy alignment and Setup process (docs); Implementation Plan Phase 2 item "Add tests for the new documents and their routes". Code tests for policy grants live with each code bead; packaging lives in its own bead.

What: new test file asserting:
- The policy names, values, recommendations, and recommended set in agent-policy-grants match the schema exported by packages/tbd/src/lib/policy-grants.ts, the block renderer's output, and setup-tbd.
- The generated tbd block (getCodexTbdSection) and each referencing doc (setup-tbd, the skill-baseline GitHub authorization section, delegate-to-subagents, review-and-merge-prs, stacked-prs) link to agent-policy-grants.
- stacked-prs, create-or-update-pr-simple, create-or-update-pr-with-validation-plan, setup-github-cli, and the tbd block state the github-stacked-prs condition.
- setup-tbd asks only about unanswered policies, offers the all-recommended answer, asks about Linear separately, and names the gh and Linear authentication steps.
- The skill tiers and welcome-user route to setup-tbd, and the skill tiers route "You can use sub-agents" to delegate-to-subagents. Setup output routing is asserted by the tests in the setup flags bead (tbd-ac0w) (tbd-ac0w).
Read source docs; import source modules for the schema, renderer, and tbd block. If an assertion exposes a doc inconsistency, report it rather than editing the doc.

Write set: packages/tbd/tests/policy-grants-docs.test.ts (new).

Acceptance: `pnpm --filter get-tbd exec vitest run tests/policy-grants-docs.test.ts`; prettier and eslint on the file.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
