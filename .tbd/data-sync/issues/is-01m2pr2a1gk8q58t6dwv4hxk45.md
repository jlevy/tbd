---
type: is
id: is-01m2pr2a1gk8q58t6dwv4hxk45
title: "P2: Add setup-tbd shortcut and point welcome-user to it"
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
    target: is-01m2pr2cx3yxc65xrmh4kpd9ef
  - type: blocks
    target: is-01m2pr2dmqqap2nf1xmjbwztaj
  - type: blocks
    target: is-01m2pr288xb6r9s0cw4j4wwfnv
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T03:55:17.935Z
updated_at: 2026-09-17T11:24:04.597Z
started_at: 2026-09-17T10:58:56.522Z
closed_at: 2026-09-17T11:24:04.597Z
close_reason: "Verified by the coordinator after a rebuild: 131 tests in 9 files (setup-tier-agents, setup-flows, doctor, setup-policy-grants, golden-output, integration-files, doc-categories, dry-run) and 62 tryscript cases (setup, setup-commands, uninstall, orientation golden) passed; typecheck, eslint, prettier, flowmark clean; committed"
resolution: null
duplicate_of: null
---
Plan: Design > Consolidated Setup Process (steps 1-7 and the upgrade note); Implementation Plan Phase 2 item 4 (shortcut and welcome-user parts); Document Changes rows setup-tbd and "Skill Installation section, welcome-user, tbd setup output" (welcome-user part); Other Documentation Updates > welcome-user. The skill Installation pointer is in tbd-7698 and the setup output pointer is in the setup flags bead (tbd-ac0w).

What:
- New shortcut setup-tbd, for new projects and every upgrade: 1) install or upgrade the CLI as the skill's Installation section describes; 2) new project: ask for the prefix and run `tbd setup --auto --prefix=<prefix>`; existing project: `tbd setup --auto`; commit the diff; 3) `tbd policy show`; 4) ask only about unanswered policies, in one message, for the project as a whole, with each recommendation and a one-line meaning from `tbd guidelines agent-policy-grants`; accept "yes, all recommended automations and review policies", individual answers, or "not now"; ask about Linear separately (default: epic beads only, in both directions); 5) record the answers with `tbd policy` or `tbd setup --policies=recommended` and commit; offer to change answered policies only when asked; 6) GitHub grants: `gh auth status` and `tbd shortcut setup-github-cli`; github-stacked-prs: stack tooling; Linear: `tbd shortcut setup-linear` with the epics selection; 7) verify with `tbd doctor` and `tbd policy show`, and report what is granted, what is unanswered, and what authentication remains. Use the exact command and flag names implemented in the policy command (tbd-42j9) and setup flags (tbd-ac0w) beads.
- welcome-user: point new users to setup-tbd, mention the policy questions, and add review-and-merge request examples (for example "Make sure PR #N is reviewed and merged").

Write set: packages/tbd/docs/shortcuts/standard/setup-tbd.md (new); packages/tbd/docs/shortcuts/standard/welcome-user.md.

Acceptance: Markdown check; `pnpm --filter get-tbd exec vitest run tests/doc-categories.test.ts tests/integration-files.test.ts` pass (read-only; keep the web viewer and Linear onboarding assertions). Doc assertions come in tbd-7u69.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
