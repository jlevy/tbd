---
type: is
id: is-01m2q1mm7cq1jm2g9seh2ra5sk
title: "P2: Add setup policy flags and route setup output to setup-tbd"
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
    target: is-01m2q1mss64y4n0wfeecq12kpk
  - type: blocks
    target: is-01m2pr2c6gds2vz3y9x0nxdwka
  - type: blocks
    target: is-01m2pr2a1gk8q58t6dwv4hxk45
  - type: blocks
    target: is-01m2pr2cx3yxc65xrmh4kpd9ef
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T06:42:35.366Z
updated_at: 2026-09-17T10:58:07.159Z
started_at: 2026-09-17T10:42:41.825Z
closed_at: 2026-09-17T10:58:07.158Z
close_reason: "Verified by the coordinator after a rebuild: setup-policy-grants, setup-flows, golden-output, doc-categories, integration-files, guideline-budget (104 tests) and cli-setup-commands tryscript passed; typecheck, eslint, prettier, flowmark clean; committed"
resolution: null
duplicate_of: null
---
Plan: Policy Grants > Recording grants ("At setup"); Consolidated Setup Process (the note that `tbd setup --auto` output tells the agent to run it after an upgrade); Implementation Plan Phase 2 items 1 ("setup grant flags") and 4 ("and tbd setup output"); Document Changes row "Skill Installation section, welcome-user, tbd setup output" (the setup output part).

What:
- Add `--policies=recommended` to `tbd setup` (plus any per-policy form that agent-policy-grants documents). It writes exactly the recommended set through the policy-grants library and leaves linear unanswered. Non-interactive setup without policy flags records nothing.
- Make fresh-setup and upgrade output (WHAT'S NEXT, and the upgrade message that asks for a commit) tell the agent to run `tbd shortcut setup-tbd` and mention unanswered policies. Add "Set up tbd" and a review-and-merge example to WHAT'S NEXT if they fit its style.
- Document the flag in the CLI manual.

Write set: packages/tbd/src/cli/commands/setup.ts; packages/tbd/tests/setup-policy-grants.test.ts; packages/tbd/tests/setup-flows.test.ts (What's Next, upgrade message); packages/tbd/tests/golden-output.test.ts; packages/tbd/tests/cli-setup-commands.tryscript.md (setup help); packages/tbd/docs/tbd-docs.md.

Acceptance (Testing Strategy > Policy grants (code), these assertions): setup with grant flags writes the block; `--policies=recommended` writes exactly the recommended set and leaves linear unanswered; setup without flags records nothing. Run `pnpm --filter get-tbd exec vitest run tests/setup-policy-grants.test.ts tests/setup-flows.test.ts tests/golden-output.test.ts` and `pnpm --filter get-tbd exec tryscript run tests/cli-setup-commands.tryscript.md`; typecheck, prettier, eslint; Markdown check on tbd-docs.md.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
