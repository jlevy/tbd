---
type: is
id: is-01m2pr2bttb3sw9d036ejwtp4t
title: "P2: Add review-and-merge-prs orchestration shortcut"
kind: task
status: open
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2pr2cx3yxc65xrmh4kpd9ef
  - type: blocks
    target: is-01m2pr288xb6r9s0cw4j4wwfnv
  - type: blocks
    target: is-01m2pr28mh17t3tye60mc3jggs
  - type: blocks
    target: is-01m2q2590d5x1nx544vc8f42a3
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:19.769Z
updated_at: 2026-09-17T06:51:40.940Z
---
Plan: Design > Orchestrated Workflow (steps 1-7); Several PRs; Single-Agent Fallback; Request Vocabulary (fix, merge-ready, and merge modes and their end states); Review Coverage and Rounds (round decision and confirmation); Policy Grants > Grants in the review workflows. Document Changes row review-and-merge-prs.

What: new orchestration shortcut.
1. Prepare: `tbd policy show` and ask for any missing authorization; pin the head SHA, merge base, CI state, and stack membership; discovery sweep; check out the pinned head, and stop and ask if the tree is dirty.
2. Review (strong tier) with review-github-pr, plus the dedicated reviews pr-review-requirements calls for.
3. Address (moderate tier) with address-pr-review per review letter, as sole committer.
4. Decide on another round using the signals; ask the user.
5. Merge gate: every condition in the plan's step 5, checked at the moment of merging, including the github-merge rules for per-request, not-granted, and unconditional.
6. Merge with the repository's merge method, never `--admin`; report branch-protection blocks.
7. Close out: `tbd sync` and a per-PR report.
Several PRs: one at a time in the shared tree, or a worktree per PR when parallel work is asked for or sub-agents are authorized for several PRs; merges one at a time; re-pin after each merge; an update from base must pass CI again, and a conflict resolution is a round signal. Delegation follows delegate-to-subagents; defaults yield to user guidance.
Judgment: reference the contract in pr-review-workflows rather than restating it, while keeping the merge gate complete and checkable in one place.

Write set: packages/tbd/docs/shortcuts/standard/review-and-merge-prs.md (new).

Acceptance: Markdown check; `pnpm --filter get-tbd exec vitest run tests/doc-categories.test.ts` passes. Contract tests in tbd-9t4e.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
