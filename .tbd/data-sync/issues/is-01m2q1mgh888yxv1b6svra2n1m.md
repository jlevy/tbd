---
type: is
id: is-01m2q1mgh888yxv1b6svra2n1m
title: "P2: Preserve the policy block in setup and state grant conditions in the tbd block"
kind: task
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2q1mm7cq1jm2g9seh2ra5sk
  - type: blocks
    target: is-01m2q1mqca5bz0trff5z8tfq0t
  - type: blocks
    target: is-01m2pr2cx3yxc65xrmh4kpd9ef
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T06:42:31.591Z
updated_at: 2026-09-17T10:32:13.511Z
started_at: 2026-09-17T10:16:45.731Z
closed_at: 2026-09-17T10:32:13.510Z
close_reason: "Batch 3 verified by the coordinator: 133 tests in 8 files passed (setup-policy-grants, setup-flows, policy-grants, cli-policy, setup-dry-run-state, doctor-managed-surfaces, doc-categories, integration-files); typecheck, eslint, prettier, flowmark clean; committed"
resolution: null
duplicate_of: null
---
Plan: Policy Grants > Persistence and The block; Policy Grants > "Stacked PRs under the grant" (the tbd block part); Implementation Plan Phase 2 items 1 ("preservation of the policy block on setup") and 5 ("and the tbd block"); Document Changes row for the tbd block in AGENTS.md.

What:
- In setup.ts, when regenerating the AGENTS.md tbd block (updatetbdSection and getCodexTbdSection), read the existing policy block and write it back byte for byte, including unknown policy names, just before END TBD INTEGRATION, using the policy-grants library. Setup never adds, removes, or changes a grant without an explicit flag or command.
- Change the generated block text so it reads the same in every project: route stacked PRs through stacked-prs only when `github-stacked-prs` is granted (otherwise propose separate PRs, and keep handling PRs that are already stacked), tell agents to check grants with `tbd policy show`, and link `tbd guidelines agent-policy-grants`. Keep the text in flowmark-canonical form (see the comment in getCodexTbdSection).
- Add the older-release guard test: a block that carries grants is stamped with the bumped integration format, so a binary whose integration format is f08 refuses to rewrite it.
doctor's block freshness comparison is updated in the doctor bead (tbd-q8js). Do not regenerate the committed AGENTS.md (packaging bead tbd-sqat).

Write set: packages/tbd/src/cli/commands/setup.ts; packages/tbd/tests/setup-policy-grants.test.ts (new); packages/tbd/tests/setup-flows.test.ts (the AGENTS.md compact managed block describe, only if its assertions change).

Acceptance (Testing Strategy > Policy grants (code), these assertions): `tbd setup --auto` on an upgrade preserves an existing block byte for byte, including unknown policy names; the older-release guard stops a rewrite that would drop grants. Run `pnpm --filter get-tbd exec vitest run tests/setup-policy-grants.test.ts tests/setup-flows.test.ts`; typecheck, prettier, eslint.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
