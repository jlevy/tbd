---
type: is
id: is-01m2pr2acyjamrjwj2pb85m83n
title: "P2: Gate stacked-PR shortcuts on github-stacked-prs"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr2cx3yxc65xrmh4kpd9ef
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:18.301Z
updated_at: 2026-09-17T06:44:02.293Z
---
Plan: Policy Grants > "Stacked PRs under the grant"; Implementation Plan Phase 2 item 5; Document Changes row for stacked-prs, create-or-update-pr-*, setup-github-cli; Other Documentation Updates (last bullet).

What: in stacked-prs, create-or-update-pr-simple, create-or-update-pr-with-validation-plan, and setup-github-cli, create or submit stacks and install the stack tooling (`ensure-gh-cli.sh --with-stack`, the pinned gh-stack extension and its agent skill) only when `github-stacked-prs` is granted; with not-granted, propose separate PRs instead; always keep the stack handling for PRs someone else already stacked; link `tbd guidelines agent-policy-grants`. The generated tbd block in AGENTS.md is changed in the setup preservation bead (tbd-r8y0), not here.
Do not edit integration-files.test.ts; keep its stacked PR routing assertions passing (draft state, `gh stack submit --auto`, "only when the user explicitly asks", formal membership, remote-only stacks). Condition-statement tests come in tbd-7u69.

Write set: packages/tbd/docs/shortcuts/standard/stacked-prs.md, create-or-update-pr-simple.md, create-or-update-pr-with-validation-plan.md, setup-github-cli.md.

Acceptance: Markdown check; `pnpm --filter get-tbd exec vitest run tests/integration-files.test.ts tests/ensure-gh-cli-script.test.ts` pass (read-only).

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
