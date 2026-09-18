---
type: is
id: is-01m2rjv6ppwnh8m4vz1r2z96wk
title: "Tier agent definitions: platform-specific bodies and caching guidance"
kind: task
status: in_progress
priority: 2
version: 9
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies:
  - type: blocks
    target: is-01m2rw79zh70pgacskvw9ejkqy
  - type: blocks
    target: is-01m2s0931f97gk8wray80g0deg
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
child_order_hints:
  - is-01m2rwa0a8t56qkzsdv3ky8gff
  - is-01m2rwdknas74aktcp603tssea
hold: null
hold_until: null
created_at: 2026-09-17T21:02:31.125Z
updated_at: 2026-09-18T00:57:18.571Z
started_at: 2026-09-18T00:57:18.570Z
---
Stacked on PR #309. From the system-prompt and prompt-caching research section in research-2026-09-16-subagent-guidance-anthropic-openai.md: drop the unreliable model/level claim from generated tier agent bodies, add the evidence-reporting rule a Claude Code sub-agent otherwise never sees, drop the coordinator-only pointer, and update agent-model-tiers and delegate-to-subagents to say what a definition buys per platform (Claude Code: effort only, and only when it differs from the session; Codex: a convenience), that the brief is the only portable contract, and the sub-agent cache TTL rule for waiting sub-agents.

## Notes

PR #310 (stacked on #309, branch claude/sharp-tesla-dqt372). Done: research sections, generator body, regenerated definitions, guideline and shortcut updates. PR #310 review A4: leave tbd-fast at medium (user has not chosen low); that decision is closed. Open: gh stack link; re-verify OpenAI caching figures (review A5, tbd-2f9j).
