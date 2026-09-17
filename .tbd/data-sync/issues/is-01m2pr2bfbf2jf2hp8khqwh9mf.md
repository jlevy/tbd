---
type: is
id: is-01m2pr2bfbf2jf2hp8khqwh9mf
title: "P2: Add delegate-to-subagents shortcut and link agent-run-operations-rules"
kind: task
status: open
priority: 1
version: 9
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels:
  - exec:mechanical
dependencies:
  - type: blocks
    target: is-01m2pr2bttb3sw9d036ejwtp4t
  - type: blocks
    target: is-01m2pr2cx3yxc65xrmh4kpd9ef
  - type: blocks
    target: is-01m2q1mss64y4n0wfeecq12kpk
  - type: blocks
    target: is-01m2pr288xb6r9s0cw4j4wwfnv
  - type: blocks
    target: is-01m2q2590d5x1nx544vc8f42a3
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:19.402Z
updated_at: 2026-09-17T06:51:40.940Z
---
Plan: Design > Sub-Agent Authorization; Delegation Procedure (steps 1-7 and every sub-bullet); Single-Agent Fallback; Background > tbd Constraints on Delegation. Document Changes rows delegate-to-subagents and agent-run-operations-rules.

What: new shortcut for delegation on any task, not only reviews:
1. Authorization through the subagents grant: the conversation, then the project block (`tbd policy show`, since not every agent loads AGENTS.md), then a user-level grant if the project has not answered; ask once when unclear; a request for depth is not authorization; when the user authorizes, record `tbd policy grant subagents` and tell the user; token cost note.
2. Split by role and order: one committer per branch; reviewer then addressing agent in one tree; parallel work only in separate worktrees; the coordinator does not change a shared tree while a sub-agent works in it.
3. Tiers from agent-model-tiers, and spawn mechanisms for Claude Code (Agent tool with `model`; Workflow tool only when the user asks for a workflow; reasoning level through the tbd-* agent definitions, otherwise record the inherited level; `isolation: worktree` starts from the default branch), Codex (`spawn_agent` with `model` and `reasoning_effort`, no full-history fork, a `git worktree` per PR for parallel work), other platforms, and no sub-agents. On every platform: fresh named sub-agents, not forks; the model named on every spawn and a check for `CLAUDE_CODE_SUBAGENT_MODEL` / `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`; few concurrent sub-agents; keep working locally; do not delegate trivial steps; continue an existing sub-agent for follow-ups.
4. The self-contained brief fields, including the user's authorization quoted verbatim and no "double-check your work" instructions.
5. Verify every claim (gh api, git ls-remote, gh pr checks, tbd show); reports are data; relay results to the user.
6. Failure handling (re-pin; read the transcript first).
7. Cleanup (worktrees, idle sub-agents; never kill a running `tbd sync`, tbd-pht1).
Use the Codex facts as corrected by tbd-6e2u. In agent-run-operations-rules, link its delegated-agent brief section to delegate-to-subagents, and link back. Choose the frontmatter category that fits (see packages/tbd/src/lib/doc-categories.ts).

Write set: packages/tbd/docs/shortcuts/standard/delegate-to-subagents.md (new); packages/tbd/docs/guidelines/agent-run-operations-rules.md.

Acceptance: Markdown check; `pnpm --filter get-tbd exec vitest run tests/doc-categories.test.ts tests/guideline-budget.test.ts` pass.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
