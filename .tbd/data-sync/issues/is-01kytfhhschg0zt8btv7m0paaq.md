---
type: is
id: is-01kytfhhschg0zt8btv7m0paaq
title: packages/tbd/.claude/skills/tbd/SKILL.md is stale vs current skill surfaces
kind: task
status: open
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - agent-skills
dependencies: []
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-07-30T21:40:30.635Z
updated_at: 2026-08-16T00:10:47.058Z
extensions:
  linear:
    id: bc86b6e4-2bf8-4ed9-a026-6971c7529fa0
    linked_at: 2026-08-16T00:10:47.058Z
---
Discovered while implementing GH #195: the packages/tbd-scoped Claude skill is hand-maintained and has drifted from the regenerated skill surfaces (old close-protocol wording, per-ID close phrasing predating the bulk-call rules from PR #198/#199, comma-separated allowed-tools). Decide: regenerate it from skill-baseline like the root skills, refresh it by hand, or delete it in favor of the root skill.

## Notes

Still real: the package-scoped Claude skill remains visibly stale versus the generated root skill. Retargeted under the active multi-agent setup epic for an explicit regenerate-or-remove decision.
