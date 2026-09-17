---
type: is
id: is-01m2q1nb56rhsdwm8nh0rnchef
title: "P3: Revise README.md to the target structure"
kind: task
status: open
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2q1ndc8pr5ck5eeta69ww1r
  - type: blocks
    target: is-01m2q1nfp9ay24j5mem0kf6z5n
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T06:42:58.852Z
updated_at: 2026-09-17T11:24:21.386Z
---
Plan: Final Documentation Updates > README Problems Today, Target Structure (12 sections, about 450 to 500 lines), README Changes items 1-9, 11-17, 20, and 21, Verification (format check and `tbd readme`); Implementation Plan Phase 3 item 1; Open Questions defaults (npm page identical to the GitHub README, neutral voice, a short policy and delegation summary linking agent-policy-grants and delegate-to-subagents, dated examples removed). Also the README part of Phase 1 item 5 and the README in Document Changes row "skill-baseline, skill-brief, skill-minimal, README".

What: restructure README.md to the target structure.
- The request table carries the full review vocabulary plus "You can use sub-agents" and "Set up tbd", with phrases identical to the skill tiers (tbd-7698).
- Quick Start and Upgrading point to setup-tbd.
- "Agent Surfaces" describes every setup surface, including the tier agent definitions (the plan's "all four setup surfaces" predates them).
- Summarize policy grants and `tbd policy show|grant|revoke|set` with a short policy block example.
- Add the FAQ "Can agents merge my PRs?" (merge gate and github-merge values).
- Remove the outer-loop paragraph.
Place section 9 (shortcuts, guidelines, and templates) with its tables, but leave table contents and counts (items 10, 18, 19) to the reference tables bead (tbd-llia), which generates them. The design doc's capability list (the second half of item 1) belongs to the other-docs bead (tbd-gcxb).
Judgment: this is a full rewrite; keep every fact correct against the CLI and skill.

Write set: README.md.

Acceptance: Markdown check on README.md; `node packages/tbd/dist/bin.mjs readme` shows the revised README; `pnpm --filter get-tbd exec vitest run tests/doc-references.test.ts` passes (README shortcut references resolve).

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.

## Notes

1. From tbd-fwo5 and tbd-gyvw: register review-code-security, review-code-performance, review-code-correctness, review-code-rust (already missing), delegate-to-subagents, review-and-merge-prs, and setup-tbd in the README shortcut table (or its generated replacement in tbd-llia); tbd-docs.md Code Review Workflow could mention the dedicated reviews.
2. From tbd-6q8n: README (~397, ~482) says four setup surfaces; there are now six (claude-agents, codex-agents). tbd status INTEGRATIONS does not list tier agents. uninstall removes tier agent files but leaves skills, hooks, and the AGENTS.md block (existing inconsistency).
