---
type: is
id: is-01m2pr26wk9nmdax9rmpxmmx5y
title: "P1: Update pr-review-workflows with the review-state contract"
kind: task
status: open
priority: 1
version: 9
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr27jhgh5jf7k9k3320pfb
  - type: blocks
    target: is-01m2pr27xvvhz6zh7xpnvfnwdv
  - type: blocks
    target: is-01m2pr288xb6r9s0cw4j4wwfnv
  - type: blocks
    target: is-01m2pr2bttb3sw9d036ejwtp4t
  - type: blocks
    target: is-01m2pr277nywf9vnc9bsy6219k
  - type: blocks
    target: is-01m2pr2chxhjtktht45z3r4155
  - type: blocks
    target: is-01m2q2590d5x1nx544vc8f42a3
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:14.706Z
updated_at: 2026-09-17T06:51:40.940Z
---
Plan: Design > Review-State Contract (header and marker, finding IDs, dispositions table, disposition replies, pinning and the working tree, channel, discovery sweep); Request Vocabulary (table and the user guidance that overrides defaults); Review Coverage and Rounds (coverage under pr-review-requirements, dedicated reviews and sensitivity lists, additional-round signals and the confirmation rule); Roles and escalation; Orchestrated Workflow step 5 (merge gate); Single-Agent Fallback; Policy Grants > "Grants in the review workflows". Document Changes row pr-review-workflows.

What: make pr-review-workflows the single definition of the contract that the other review shortcuts link to. Use the marker strings exactly as the plan shows them (`<!-- tbd:review v=1 id=A kind=senior pr=306 round=1 head=<40-hex> base=<40-hex> -->` and `<!-- tbd:dispositions v=1 review=A head=<40-hex> -->`, with kind one of senior, security, performance, correctness, follow-up). Link by name to review-and-merge-prs, delegate-to-subagents, review-code-security, review-code-performance, review-code-correctness, and `tbd guidelines agent-policy-grants` / `agent-model-tiers`; other beads create those, and doc-reference resolution is checked in the packaging bead (tbd-sqat). Keep the existing stacked-PR rules and the integration-files.test.ts assertions passing.

Write set: packages/tbd/docs/shortcuts/standard/pr-review-workflows.md.

Acceptance: Markdown check; `pnpm --filter get-tbd exec vitest run tests/integration-files.test.ts` passes (read-only run). Contract tests follow in tbd-9t4e.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
