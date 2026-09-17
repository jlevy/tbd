---
type: is
id: is-01m2rjv6ppwnh8m4vz1r2z96wk
title: "Tier agent definitions: platform-specific bodies and caching guidance"
kind: task
status: in_progress
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T21:02:31.125Z
updated_at: 2026-09-17T21:31:05.992Z
---
Stacked on PR #309. From the system-prompt and prompt-caching research section in research-2026-09-16-subagent-guidance-anthropic-openai.md: drop the unreliable model/level claim from generated tier agent bodies, add the evidence-reporting rule a Claude Code sub-agent otherwise never sees, drop the coordinator-only pointer, and update agent-model-tiers and delegate-to-subagents to say what a definition buys per platform (Claude Code: effort only, and only when it differs from the session; Codex: a convenience), that the brief is the only portable contract, and the sub-agent cache TTL rule for waiting sub-agents.

## Notes

PR #310 (stacked on #309, branch claude/sharp-tesla-dqt372). Done: research sections, generator body, regenerated definitions, guideline and shortcut updates. Open: gh stack link (no gh token in session); tbd-fast level decision; re-verify OpenAI caching figures.
