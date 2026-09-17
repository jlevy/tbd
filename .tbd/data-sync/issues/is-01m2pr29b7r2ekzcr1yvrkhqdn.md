---
type: is
id: is-01m2pr29b7r2ekzcr1yvrkhqdn
title: "P2: Add agent-policy-grants guideline"
kind: task
status: open
priority: 1
version: 9
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2pr29pdwg1f8t2pecdg9e9c
  - type: blocks
    target: is-01m2pr2a1gk8q58t6dwv4hxk45
  - type: blocks
    target: is-01m2pr2acyjamrjwj2pb85m83n
  - type: blocks
    target: is-01m2pr2ar677f231j1s39bxra1
  - type: blocks
    target: is-01m2pr2bfbf2jf2hp8khqwh9mf
  - type: blocks
    target: is-01m2pr2cx3yxc65xrmh4kpd9ef
  - type: blocks
    target: is-01m2q2590d5x1nx544vc8f42a3
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:17.222Z
updated_at: 2026-09-17T06:51:40.940Z
---
Plan: Design > Policy Grants (all subsections); Consolidated Setup Process step 4; Document Changes row agent-policy-grants.

What: new guideline, the single definition of the seven policies (github-workflows, github-editing, github-merge, github-stacked-prs, subagents, pr-review-requirements, linear): values, recommendation, and what each covers; neither GitHub grant covers repository settings, secrets, or workflow files; answered vs unanswered (missing means not-granted, or standard for pr-review-requirements); merging without review needs two explicit grants; the recommended set (linear outside it, always asked separately); stacked PRs under the grant; what `linear: epics` means; grant sources and precedence (conversation, then an answered project policy, then a user-level grant only for unanswered policies); the default-branch rule; visibility (tbd prime) and validation (tbd doctor); permissions never bypassed; how grants are recorded (setup flags; `tbd policy show|grant|revoke|set`; agents record only explicit grants; a single merge authorization never records a grant); the exact block syntax (`<!-- BEGIN TBD POLICY GRANTS v=1 -->` ... `<!-- END TBD POLICY GRANTS -->`, heading, bullet format, "Recorded <date>" line, placement just before END TBD INTEGRATION); the setup questions with one-line meanings.
Judgment: define a precise grammar for custom values (pr-review-requirements such as `standard + security` or `standard + 2 rounds`; a custom linear selection). tbd-42j9's schema and parser implement exactly this grammar, and tbd-7u69 tests the alignment.
Frontmatter category `general`, like agent-run-operations-rules. Do not register it in doc-cache.ts (the packaging bead (tbd-sqat) does).

Write set: packages/tbd/docs/guidelines/agent-policy-grants.md (new).

Acceptance: Markdown check; `pnpm --filter get-tbd exec vitest run tests/doc-categories.test.ts tests/guideline-groups.test.ts` pass.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
