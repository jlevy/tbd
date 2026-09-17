---
type: is
id: is-01m2pr29pdwg1f8t2pecdg9e9c
title: "P2: Port #308's GitHub authorization rules into skill-baseline"
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr288xb6r9s0cw4j4wwfnv
  - type: blocks
    target: is-01m2pr2cx3yxc65xrmh4kpd9ef
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:17.580Z
updated_at: 2026-09-17T06:45:00.152Z
---
Plan: Background > PR #308; Policy Grants > Reading grants; Implementation Plan Phase 2 item 2; Document Changes row "skill-baseline GitHub authorization section".

What: add a standalone GitHub Authorization section to skill-baseline, outside the Session Closing Protocol (A4). Content: check grants with `tbd policy show` before GitHub mutations, merging, or delegation; the project policy block on the default branch is the primary record, the current conversation overrides it for one task, and user-level grants apply only to policies the project has not answered; name the policies (github-workflows, github-editing, github-merge, github-stacked-prs, subagents) and link `tbd guidelines agent-policy-grants` instead of restating them; keep #308's operational rules (plain, single-purpose `gh` commands; ask for the specific permission when a tool blocks a granted action; keep authentication, authorization, and tool permissions distinct; never infer a grant from memory); a tool-permission allow rule grants only the operations it allows (A3). Do not keep #308's user-level-only rule.
Port #308's phrase test (`git show 870f59e9 -- packages/tbd/tests/integration-files.test.ts`; branch origin/pr-308), adapted to the new wording. Regenerate skills/tbd/SKILL.md (claude-header plus skill-baseline, composed by the copy-docs postbuild step of `pnpm --filter get-tbd build`) so its drift test passes. Do not regenerate the .claude or .agents skill copies (packaging bead tbd-sqat).

Write set: packages/tbd/docs/shortcuts/system/skill-baseline.md; skills/tbd/SKILL.md; packages/tbd/tests/integration-files.test.ts.

Acceptance: `pnpm --filter get-tbd exec vitest run tests/integration-files.test.ts` (phrase test and drift test pass); Markdown check on skill-baseline.md; prettier and eslint on the test file.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
