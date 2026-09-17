---
type: is
id: is-01m2pr2b3n3e6xjq7t4khw113p
title: "P2: Add agent-model-tiers guideline"
kind: task
status: open
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr2bfbf2jf2hp8khqwh9mf
  - type: blocks
    target: is-01m2pr2c6gds2vz3y9x0nxdwka
  - type: blocks
    target: is-01m2pr28mh17t3tye60mc3jggs
  - type: blocks
    target: is-01m2q2590d5x1nx544vc8f42a3
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:19.028Z
updated_at: 2026-09-17T06:51:40.940Z
---
Plan: Design > Model Tiers; Document Changes row agent-model-tiers.

What: new provider-neutral guideline. Tiers strong, moderate, and fast, defined by model rank and reasoning level within the agent's own provider, with the work each tier does (the plan's table). Selection rules: rank your own platform's models; use the higher level within a tier's range for harder or riskier work; single-model platforms use the top two levels for strong and moderate and middle levels for fast; with no reasoning control vary only the model; if the strongest model is unavailable use the best available, record the substitution, and tell the user; record the requested tier, model, and level for every delegated task. The dated block must start exactly "Suggestions as of 2026-09-16, not requirements." followed by the keep-current note and the Anthropic/OpenAI example table (use identifiers as corrected by tbd-6e2u if it has landed). Mention the generated tier agent definitions (tbd-strong-max, tbd-strong, tbd-moderate, tbd-fast) as how Claude Code gets a per-tier reasoning level. Category `general`. Do not register it in doc-cache.ts.

Write set: packages/tbd/docs/guidelines/agent-model-tiers.md (new).

Acceptance: Markdown check; `pnpm --filter get-tbd exec vitest run tests/doc-categories.test.ts tests/guideline-groups.test.ts` pass. Contract assertions come in tbd-9t4e; tbd-6q8n reads the suggested models and levels.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
