---
type: is
id: is-01m2pttfc7cp9qz4ynvaxm16vx
title: "P2: Remove the CLAUDE_CODE_SUBAGENT_MODEL pin from .claude/settings.json"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2q1n82ewxqyytff9f2sftj2
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T04:43:26.982Z
updated_at: 2026-09-17T06:44:14.782Z
---
Plan: Implementation Plan > Phase 2 item "Remove the CLAUDE_CODE_SUBAGENT_MODEL pin"; Background > tbd Constraints on Delegation. Decision made: remove the pin (tbd names a model on every spawn; the pin only downgrades unnamed spawns to Opus 4.6).

What: delete the `CLAUDE_CODE_SUBAGENT_MODEL` entry from the `env` object in this repository's committed .claude/settings.json, and the `env` object itself if it becomes empty. Leave hooks untouched. Do not edit research docs that mention the variable.

Write set: .claude/settings.json.

Acceptance: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"` succeeds; `git diff` shows only the env removal; `pnpm exec prettier --check .claude/settings.json`.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
