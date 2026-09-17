---
type: is
id: is-01m2q1n82ewxqyytff9f2sftj2
title: "P2: Packaging check and regenerate committed agent surfaces"
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
    target: is-01m2q1nb56rhsdwm8nh0rnchef
  - type: blocks
    target: is-01m2pr2dmqqap2nf1xmjbwztaj
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T06:42:55.693Z
updated_at: 2026-09-17T11:50:35.723Z
started_at: 2026-09-17T11:45:31.235Z
closed_at: 2026-09-17T11:50:35.722Z
close_reason: Guidelines registered; setup --auto with the local build regenerated AGENTS.md (f100), skill copies, and tier agent definitions; doctor healthy; acceptance and contract tests (109) passed; cli-doc-output golden updated (9/9); committed
resolution: null
duplicate_of: null
---
Plan: Testing Strategy > Packaging; docs/development.md > "Testing new shortcuts, guidelines, or templates". Runs after every Phase 1 and Phase 2 bead.

What:
1. Register agent-policy-grants and agent-model-tiers in the guideline groups (CROSS_CUTTING_NAMES in packages/tbd/src/file/doc-cache.ts, beside agent-run-operations-rules), or report why another group fits better.
2. Run `pnpm --filter get-tbd build`, then `node packages/tbd/dist/bin.mjs setup --auto` at the repository root.
3. Confirm that `node packages/tbd/dist/bin.mjs shortcut <name>` resolves setup-tbd, delegate-to-subagents, review-and-merge-prs, review-code-security, review-code-performance, and review-code-correctness, and that `guidelines <name>` resolves agent-policy-grants and agent-model-tiers.
4. Keep the regenerated committed surfaces: the AGENTS.md tbd block (new block text, new integration format stamp), .claude/skills/tbd/SKILL.md, .agents/skills/tbd/SKILL.md, skills/tbd/SKILL.md, the new .claude/agents/tbd-*.md and .codex/agents/tbd-*.toml, and any other tracked generated file that changes (for example packages/tbd/.claude/skills/tbd/SKILL.md or hook entries in .claude/settings.json).
5. Check the .tbd/config.yml diff and keep only intended changes (a global tbd rewrites docs_cache).
Report the generated-file diff summary to the coordinator.

Write set: packages/tbd/src/file/doc-cache.ts; the generated files named above.

Acceptance: `pnpm --filter get-tbd exec vitest run tests/doc-references.test.ts tests/guideline-groups.test.ts tests/guideline-budget.test.ts tests/doc-categories.test.ts tests/integration-files.test.ts`; `node packages/tbd/dist/bin.mjs doctor` reports current managed surfaces; prettier and eslint on doc-cache.ts. Generated skill surfaces are excluded from the Markdown formatter.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.

## Notes

From tbd-r8y0 and tbd-eeoi: regenerate the committed AGENTS.md, .agents/skills/tbd/SKILL.md, and .claude/skills/tbd/SKILL.md (still f08 with old block text). Outside earlier write sets, flowmark would reformat getCodexNewAgentsFile's template and POLICY_BLOCK_PROSE (pinned byte for byte by the guideline and tests); decide whether to make them canonical together.
From tbd-7va1: packages/tbd/.claude/ (hooks, settings.json, skills/tbd/SKILL.md) is tracked in git and stale (old sub-agents tip, four surfaces); decide whether to refresh it or stop tracking it.
