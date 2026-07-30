---
type: is
id: is-01kytfhhschg0zt8btv7m0paaq
title: packages/tbd/.claude/skills/tbd/SKILL.md is stale vs current skill surfaces
kind: task
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-07-30T21:40:30.635Z
updated_at: 2026-07-30T21:40:30.635Z
---
Discovered while implementing GH #195: the packages/tbd-scoped Claude skill is hand-maintained and has drifted from the regenerated skill surfaces (old close-protocol wording, per-ID close phrasing predating the bulk-call rules from PR #198/#199, comma-separated allowed-tools). Decide: regenerate it from skill-baseline like the root skills, refresh it by hand, or delete it in favor of the root skill.
