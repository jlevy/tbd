---
type: is
id: is-01m2pr26h75crmcgbdddxq7z1n
title: "P1: Re-verify Codex platform facts and correct the research brief"
kind: task
status: closed
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels:
  - exec:judgment
dependencies:
  - type: blocks
    target: is-01m2pr2ar677f231j1s39bxra1
  - type: blocks
    target: is-01m2pr2bfbf2jf2hp8khqwh9mf
  - type: blocks
    target: is-01m2pr2c6gds2vz3y9x0nxdwka
  - type: blocks
    target: is-01m2q2590d5x1nx544vc8f42a3
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-17T03:55:14.341Z
updated_at: 2026-09-17T09:55:12.468Z
started_at: 2026-09-17T06:54:30.201Z
closed_at: 2026-09-17T09:55:12.467Z
close_reason: Fable sub-agent re-verified Codex/OpenAI facts against docs and openai/codex b0659c53; coordinator checked plan edits were confined to the named sections, citations stable (V16 repinned, V38 added), formatting; committed with plan alignment fixes
resolution: null
duplicate_of: null
---
Plan: Implementation Plan > Phase 1 item 1; Background > "Sub-Agent Platforms and Vendor Guidance".

What: re-check every Codex/OpenAI fact the plan depends on against current Codex docs and source, and correct the research brief: per-spawn `model` and `reasoning_effort` on `spawn_agent`; forks rejecting model and effort overrides; Codex spawning sub-agents only when the user, AGENTS.md, or a skill asks [V13], [V16]; whether sub-agents share the parent's working copy, per Codex CLI version; the `.codex/agents/*.toml` fields (`model`, `model_reasoning_effort`, `developer_instructions`) that Tier Agent Definitions uses; current model identifiers for the dated suggestions. Keep [V#] numbering stable. Where a fact changed, also correct the plan's fact bullets and the Codex items in Delegation Procedure step 3 and Tier Agent Definitions. Report every correction to the coordinator: tbd-gyvw (delegate-to-subagents) and tbd-6q8n (tier agent definitions) consume these facts.

Write set:
- docs/project/research/current/research-2026-09-16-subagent-guidance-anthropic-openai.md
- docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md (only the sections named above)

Acceptance: each re-checked fact cites its source and check date in the brief; Markdown check on both files. No code or tests.

Rules: the coordinator commits and syncs. Do not commit, push, run `tbd sync`, or edit the plan spec unless the write set lists it. Keep scratch files in the session scratch directory. Run only the targeted checks listed, not the full suite.
Markdown check: `uvx --exclude-newer-package flowmark-rs=2026-05-31 flowmark-rs@0.3.1 --auto --check <files>` (per-file form of `pnpm format:md:check`). TypeScript checks: `pnpm exec prettier --check <files>`, `pnpm exec eslint <files>`, `pnpm --filter get-tbd typecheck`. Tests that read `packages/tbd/dist/` (integration-files, doc-references, setup-flows, golden-output, tryscripts) need a current build: run `pnpm --filter get-tbd build` once if dist is stale.
