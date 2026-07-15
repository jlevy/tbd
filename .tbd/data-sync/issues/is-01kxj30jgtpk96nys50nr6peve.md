---
type: is
id: is-01kxj30jgtpk96nys50nr6peve
title: "GitHub #190: Refresh skill-creation guidance and setup dry-run safety"
kind: epic
status: in_progress
priority: 1
version: 18
labels:
  - github-190
  - agent-skills
  - guidelines
dependencies:
  - type: blocks
    target: is-01ksc0sv2xc7j6wnb9xzsep7fg
child_order_hints:
  - is-01kxj31xy6xj3s5b2e8h485tte
  - is-01kxj31ya0j51x4tjbfehrhbva
  - is-01kxj31ym97hbdhzs0tpf8bzjj
  - is-01kxj31yy0vb595rat94gsdr2f
  - is-01kxj31z8kb3ah2x1k0wmjbm0w
  - is-01kxj31zjvcsgpdtb33r37nqjc
  - is-01kxj31zwqhycex8wpptw3srga
  - is-01kxj32069ar3a92ajpq41n0yf
  - is-01kxj32wgrjfa51wytr33z286r
  - is-01kxj32xtn7978fy1cw6f61qca
created_at: 2026-07-15T05:11:54.136Z
updated_at: 2026-07-15T05:59:29.077Z
---
Source: https://github.com/jlevy/tbd/issues/190

Outcome: refresh cli-agent-skill-patterns around the Flowmark L2b bundle lessons and fix the independent setup --dry-run mutation regression found during the audit.

Review decisions to preserve:
- Keep the current architecture as the foundation, but split the 1,594-line guideline into a concise core and one-level on-demand references.
- Treat SKILL.md, references, scripts, and assets as one logical bundle. Prefer atomic directory replacement; dependency-first publication with SKILL.md last is failure-safe only under stated compatibility conditions and is not a transaction.
- Distinguish printed SKILL.md text, temporary materialization, installed bundles, and separate CLI distribution.
- Update the current skills CLI model: project and global scopes, whole-folder add, temporary whole-bundle use, copy/symlink modes, and pinned installer plus pinned source for automation.
- Treat allowed-tools as experimental, space-separated metadata and never pre-approve wildcard package runners such as npx or uvx.
- Make JSON, setup, prime, hooks, brief/full tiers, and DocCache conditional on the ladder rung and use case.
- Use current Codex guidance: direct skill folders for local/repo authoring; plugins are the Codex distribution recommendation beyond one repo, while cross-agent skill-directory distribution remains valid. agents/openai.yaml stays optional.
- Fold issue #161, Know that; fetch how, into the concise core.
- Keep one Flowmark skill; do not proliferate per-operation skills or require per-agent plugins.

The setup bug is an independent code workstream: dry-run must leave the repository, ignored cache/state, and shared git-common-dir state byte-for-byte unchanged while still reporting the planned changes.

## Notes

Implementation complete on codex/issue-190-skill-guidance. Core reduced from 1,594 to 349 lines; added bundle-publication, distribution, and platform-integration references; wording is 'Front-load orientation; retrieve procedures on demand.' Setup dry-run is byte-preserving across linked-worktree project/shared state; doctor uses shared inspection for skills, AGENTS.md, and hooks. Validation: Flowmark second pass no-op; 14 primary URLs returned HTTP 200; local build/setup/docs routes verified; generated portable/Claude mirrors identical; pnpm run ci passed 90 test files/1,373 tests; pnpm publint passed. The cosmetic surface= cleanup remains intentionally deferred in tbd-230y until a real format migration. GitHub #161/#190 closure is merge-gated and will be wired through the PR.
