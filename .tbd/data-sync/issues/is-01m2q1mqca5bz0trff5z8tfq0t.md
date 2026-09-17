---
type: is
id: is-01m2q1mqca5bz0trff5z8tfq0t
title: "P2: Validate the policy block in tbd doctor"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2q1n82ewxqyytff9f2sftj2
  - type: blocks
    target: is-01m2pr2c6gds2vz3y9x0nxdwka
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T06:42:38.592Z
updated_at: 2026-09-17T06:44:53.427Z
---
Plan: Policy Grants > Reading grants (Validation) and Source of truth; Implementation Plan Phase 2 item 1 ("tbd doctor checks").

What: `tbd doctor` reports a malformed policy block (markers, heading, bullet syntax, placement outside the tbd block), unknown values for known policies, and a working-tree block that differs from the default branch's committed block. Decide whether unknown policy names warn, given that setup preserves them, and report the choice. Update doctor's AGENTS.md managed-block freshness check (the getCodexTbdSection comparison in doctor.ts) so an embedded policy block does not make a current block look stale.

Write set: packages/tbd/src/cli/commands/doctor.ts; packages/tbd/tests/doctor-policy-grants.test.ts (new); packages/tbd/tests/doctor-managed-surfaces.test.ts (if the freshness assertions change).

Acceptance (Testing Strategy > Policy grants (code), these assertions): `tbd doctor` reports a malformed block and a working-tree block that differs from the default branch. Run `pnpm --filter get-tbd exec vitest run tests/doctor-policy-grants.test.ts tests/doctor-managed-surfaces.test.ts`; typecheck, prettier, eslint.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
