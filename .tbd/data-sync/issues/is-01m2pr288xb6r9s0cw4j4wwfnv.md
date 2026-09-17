---
type: is
id: is-01m2pr288xb6r9s0cw4j4wwfnv
title: "P1: Route the review vocabulary, setup-tbd, and delegation in every skill tier"
kind: task
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr28mh17t3tye60mc3jggs
  - type: blocks
    target: is-01m2pr2cx3yxc65xrmh4kpd9ef
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:16.124Z
updated_at: 2026-09-17T06:44:59.916Z
---
Plan: Request Vocabulary; Implementation Plan Phase 1 item 5 (skill tiers; the README rows are in the README revision bead (tbd-v8am), tbd-prime in the prime bead (tbd-7va1), code-review-rules in tbd-me2l); Other Documentation Updates > skill-baseline, skill-brief, skill-minimal; Document Changes rows "skill-baseline, skill-brief, skill-minimal, README" and "Skill Installation section".

What: in skill-baseline's "User Request → Agent Action" table and in skill-brief and skill-minimal, route with identical phrases in all three tiers:
- "Review PR #N" → review-github-pr
- "Address the reviews on PR #N" → address-pr-review
- "Review and fix PR #N", "Get PR #N merge-ready", "Make sure PR #N is reviewed and merged" → review-and-merge-prs (fix, merge-ready, merge mode)
- "You can use sub-agents" → delegate-to-subagents
- "Set up tbd" and upgrades → setup-tbd
Point the skill-baseline Installation section to setup-tbd for new projects and after every upgrade. Give skill-brief and skill-minimal a one-line pointer to the GitHub authorization rules (check grants with `tbd policy show`; see agent-policy-grants). Keep existing routes and the web viewer, Linear, and stacked PR assertions in integration-files.test.ts. Regenerate skills/tbd/SKILL.md (copy-docs postbuild step of `pnpm --filter get-tbd build`).

Write set: packages/tbd/docs/shortcuts/system/skill-baseline.md, skill-brief.md, skill-minimal.md; skills/tbd/SKILL.md.

Acceptance: `pnpm --filter get-tbd exec vitest run tests/integration-files.test.ts` after a build (drift test included); Markdown check on the three skill sources. Route assertions come in tbd-9t4e and tbd-7u69.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
