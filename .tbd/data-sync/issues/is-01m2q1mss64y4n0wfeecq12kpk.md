---
type: is
id: is-01m2q1mss64y4n0wfeecq12kpk
title: "P2: Show effective and unanswered grants in tbd prime; point tbd-prime to delegate-to-subagents"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2q1n82ewxqyytff9f2sftj2
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T06:42:41.061Z
updated_at: 2026-09-17T11:33:54.220Z
started_at: 2026-09-17T11:24:51.678Z
closed_at: 2026-09-17T11:33:54.219Z
close_reason: "Verified by the coordinator after a rebuild: prime, golden-output, integration-files, doc-categories, guideline-budget (52 tests) and cli-prime tryscript (27) passed; typecheck, eslint, prettier, flowmark clean; skills/tbd/SKILL.md regenerated; committed"
resolution: null
duplicate_of: null
---
Plan: Policy Grants > Reading grants (Visibility); Consolidated Setup Process (prime mentions unanswered policies); Other Documentation Updates > tbd-prime; Implementation Plan Phase 1 item 5 ("update tbd-prime") and Phase 2 item 1 ("tbd prime output"); Document Changes row tbd-prime.

What:
- `tbd prime` prints the effective grants (read from the default branch through the policy-grants library) and lists unanswered policies with a pointer to `tbd shortcut setup-tbd`. Keep the output compact, and print nothing about grants when AGENTS.md has no tbd block.
- In tbd-prime.md, replace the "use parallel subagents" tip with a pointer to `tbd shortcut delegate-to-subagents`, and tell agents to check grants before GitHub mutations, merging, or delegation.

Write set: packages/tbd/src/cli/commands/prime.ts; packages/tbd/docs/tbd-prime.md; packages/tbd/tests/prime.test.ts; packages/tbd/tests/cli-prime.tryscript.md; packages/tbd/tests/golden-output.test.ts only if its prime assertions change.

Acceptance (Testing Strategy > Policy grants (code), this assertion): `tbd prime` prints effective grants. Run `pnpm --filter get-tbd exec vitest run tests/prime.test.ts tests/golden-output.test.ts` and `pnpm --filter get-tbd exec tryscript run tests/cli-prime.tryscript.md`; typecheck, prettier, eslint; Markdown check on tbd-prime.md.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
