---
type: is
id: is-01m2pr2906rqnap8ry6ym5ceby
title: "P2: Policy grants library and tbd policy command"
kind: task
status: open
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2pr2a1gk8q58t6dwv4hxk45
  - type: blocks
    target: is-01m2pr2cx3yxc65xrmh4kpd9ef
  - type: blocks
    target: is-01m2q1mgh888yxv1b6svra2n1m
  - type: blocks
    target: is-01m2q1mqca5bz0trff5z8tfq0t
  - type: blocks
    target: is-01m2q1mss64y4n0wfeecq12kpk
  - type: blocks
    target: is-01m2q1mwg7g79zbsqy77xwrdbw
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:16.869Z
updated_at: 2026-09-17T06:43:55.648Z
---
Plan: Policy Grants (Policies table, Answered and unanswered policies, The recommended set, The block, Recording grants, Source of truth, Reading grants); Implementation Plan Phase 2 item 1 (the `tbd policy` command part); Document Changes row "setup.ts, a new tbd policy command, tbd prime, tbd doctor (code)". Other parts of that item are split out: integration-format split, setup preservation, setup flags, prime, doctor.

What:
- New library module: the policy schema (names, values, recommendations, recommended set) matching agent-policy-grants exactly, including its custom-value grammar; parse and render the `<!-- BEGIN TBD POLICY GRANTS v=1 -->` block, preserving unknown policy names and their order; locate the block inside the tbd managed block in AGENTS.md, just before END TBD INTEGRATION; read effective grants from the default branch's committed AGENTS.md (a grant on an unmerged branch is not effective) and from the working tree. Export the schema and renderer for the alignment tests in tbd-7u69. Name the module policy-grants to avoid confusion with the Linear policy module (packages/tbd/src/integrations/core/policy.ts).
- New command: `tbd policy show` (answered vs unanswered policies and effective values), `grant <policy>`, `revoke <policy>`, `set <policy> <value>`, editing the block in the working tree. Writing a block must leave the tbd block stamped with the integration format from the format-split bead (tbd-eeoi). Register the command in cli.ts and document it in the CLI manual.
Decisions to make and report: behavior when AGENTS.md or its tbd block is missing (for example setup ran with --surfaces excluding agents-md); which ref is "the default branch" (local default branch or its remote-tracking ref); how show presents a working-tree block that differs from the default branch.

Write set: packages/tbd/src/lib/policy-grants.ts (new); packages/tbd/src/cli/commands/policy.ts (new); packages/tbd/src/cli/cli.ts; packages/tbd/docs/tbd-docs.md; packages/tbd/tests/policy-grants.test.ts (new); packages/tbd/tests/cli-policy.test.ts (new); packages/tbd/tests/cli-setup.tryscript.md (top-level help lists `policy`).

Acceptance (Testing Strategy > Policy grants (code), these assertions): `tbd policy` round trips each policy and value; unknown policy names are preserved; `tbd policy show` distinguishes answered from unanswered policies; a grant on an unmerged branch is not effective. Run `pnpm --filter get-tbd exec vitest run tests/policy-grants.test.ts tests/cli-policy.test.ts` and `pnpm --filter get-tbd exec tryscript run tests/cli-setup.tryscript.md`; typecheck, prettier, eslint; Markdown check on tbd-docs.md.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
