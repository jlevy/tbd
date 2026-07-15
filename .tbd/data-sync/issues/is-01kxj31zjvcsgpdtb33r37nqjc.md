---
type: is
id: is-01kxj31zjvcsgpdtb33r37nqjc
title: Refresh Codex skill and plugin guidance from current official docs
kind: task
status: open
priority: 2
version: 2
labels:
  - documentation
  - codex
  - agent-skills
dependencies:
  - type: blocks
    target: is-01kxj32069ar3a92ajpq41n0yf
parent_id: is-01kxj30jgtpk96nys50nr6peve
created_at: 2026-07-15T05:12:40.282Z
updated_at: 2026-07-15T05:13:45.179Z
---
Update the Codex-specific section using current official OpenAI documentation.

Acceptance criteria:
- Document the initial skill-list budget of at most 2 percent of model context, or 8,000 characters when context size is unknown, and compare it with target-specific budgets rather than generalizing Claude behavior.
- Preserve front-loaded descriptions because Codex shortens descriptions before omitting skills.
- Keep agents/openai.yaml optional for UI metadata, invocation policy, and tool dependencies; portable name and description remain the universal requirement.
- Distinguish local/repo authoring from distribution: direct .agents/skills directories are valid locally, while current Codex guidance recommends plugins for reusable distribution beyond one repo, including a single reusable skill, bundles, or connector-backed capabilities.
- Present plugins as Codex-channel packaging, not a requirement of the open Agent Skills format or a reason to proliferate agent-specific surfaces for a small cross-agent skill.
- Cite the current official skill and plugin pages and avoid source-code/version snapshots when public docs cover the behavior.
